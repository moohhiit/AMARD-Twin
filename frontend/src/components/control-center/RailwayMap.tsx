import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  Panel,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { Maximize2, Eye } from 'lucide-react';
import { clsx } from 'clsx';

import { StationNode } from './StationNode';
import { JunctionNode } from './JunctionNode';
import { SignalNode } from './SignalNode';
import { TrainNode } from './TrainNode';
import { TrackNode } from './TrackNode';
import { useTrainStore, useSignalStore } from '@/store';
import { useNetworkStateQuery } from '@/hooks/useNetworkState';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import type { NetworkState } from '@/types';

const nodeTypes: NodeTypes = {
  station: StationNode,
  junction: JunctionNode,
  signal: SignalNode,
  train: TrainNode,
  track: TrackNode,
};

interface RailwayMapProps {
  fullScreen?: boolean;
  onFullScreenToggle?: () => void;
  className?: string;
}

function generateNodesFromState(state: NetworkState): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  const stationXSpacing = 280;
  const stationYBase = 300;
  const trackYSpacing = 60;

  const trains = state.trains || [];
  const tracks = state.tracks || [];
  const signals = state.signals || [];
  const zones = state.zones || [];
  const platforms = state.platforms || [];
  const stations = state.stations || [];
  const junctions = state.junctions || [];
  const events = state.events || [];

  // Create station nodes
  stations.forEach((station, index: number) => {
    const position = { x: 120 + index * stationXSpacing, y: stationYBase - 180 };
    nodePositions.set(station.station_id, position);
    nodes.push({
      id: station.station_id,
      type: 'station',
      position,
      data: {
        station,
        trainCount: trains.filter((t) => t.current_track?.startsWith(station.station_id)).length,
      },
    });

    // Create platform nodes connected to stations
    const stationPlatforms = station.platforms || [];
    stationPlatforms.forEach((platform: Record<string, unknown>, pIdx: number) => {
      const platformId = (platform.platform_id as string) || `${station.station_id}-P${pIdx}`;
      const platPos = {
        x: position.x + (pIdx - 1) * 100,
        y: position.y + 140,
      };
      nodePositions.set(platformId, platPos);
      nodes.push({
        id: platformId,
        type: 'default',
        position: platPos,
        data: { label: `PF ${(platform.platform_number as string) || pIdx}` },
        style: {
          background: '#1a2235',
          border: '1px solid #2a3550',
          color: '#94a3b8',
          fontSize: '10px',
          padding: '4px 8px',
          borderRadius: '4px',
        },
      });
      edges.push({
        id: `e-${station.station_id}-${platformId}`,
        source: station.station_id,
        target: platformId,
        type: 'smoothstep',
        style: { stroke: '#374c6d', strokeWidth: 1 },
      });
    });
  });

  // Create track segment nodes
  tracks.forEach((track, index: number) => {
    const connectedStation = stations.find((s) =>
      track.track_id.includes(s.station_id)
    );
    const baseX = connectedStation ? (nodePositions.get(connectedStation.station_id)?.x || 200) : 200;
    const position = {
      x: baseX + (index % 3) * 160,
      y: stationYBase + Math.floor(index / 3) * trackYSpacing,
    };
    nodePositions.set(track.track_id, position);

    const trainCount = trains.filter((t) => t.current_track === track.track_id).length;
    const isBlocked = track.status === 'BLOCKED' || track.status === 'MAINTENANCE';

    nodes.push({
      id: track.track_id,
      type: 'track',
      position,
      data: { track, trainCount, isBlocked },
    });

    // Connect tracks to stations
    if (connectedStation) {
      const sPlatforms = connectedStation.platforms || [];
      const matchingPlatform = sPlatforms.find((p: Record<string, unknown>) => p.connected_track === track.track_id);
      if (matchingPlatform && (matchingPlatform as Record<string, unknown>).platform_id) {
        const pid = (matchingPlatform as Record<string, unknown>).platform_id as string;
        edges.push({
          id: `e-${pid}-${track.track_id}`,
          source: pid,
          target: track.track_id,
          type: 'smoothstep',
          style: { stroke: '#374c6d', strokeWidth: 2 },
        });
      } else {
        edges.push({
          id: `e-${connectedStation.station_id}-${track.track_id}`,
          source: connectedStation.station_id,
          target: track.track_id,
          type: 'smoothstep',
          style: { stroke: '#374c6d', strokeWidth: 2 },
        });
      }
    }
  });

  // Create signal nodes
  signals.forEach((signal, index: number) => {
    const trackPos = nodePositions.get(signal.controlled_track);
    const position = trackPos
      ? { x: trackPos.x + 80, y: trackPos.y - 40 + index * 20 }
      : { x: 500 + index * 60, y: stationYBase - 60 };
    nodePositions.set(signal.signal_id, position);

    nodes.push({
      id: signal.signal_id,
      type: 'signal',
      position,
      data: { signal },
    });

    edges.push({
      id: `e-${signal.controlled_track}-${signal.signal_id}`,
      source: signal.controlled_track,
      target: signal.signal_id,
      type: 'straight',
      style: { stroke: '#374c6d', strokeWidth: 1 },
    });
  });

  // Create junction nodes
  junctions.forEach((junction, index: number) => {
    const position = {
      x: 100 + index * 200,
      y: stationYBase + 100,
    };
    if (junction.connected_tracks?.[0]) {
      const refPos = nodePositions.get(junction.connected_tracks[0]);
      if (refPos) {
        position.x = refPos.x + 60;
        position.y = refPos.y + 50;
      }
    }
    nodePositions.set(junction.junction_id, position);

    const conflictCount = events.filter(
      (e) => e.event_type === 'ROUTE_CONFLICT' && e.location === junction.junction_id
    ).length;

    nodes.push({
      id: junction.junction_id,
      type: 'junction',
      position,
      data: { junction, conflictCount },
    });

    // Connect junctions to tracks
    junction.connected_tracks?.forEach((trackId: string) => {
      edges.push({
        id: `e-${junction.junction_id}-${trackId}`,
        source: junction.junction_id,
        target: trackId,
        type: 'smoothstep',
        style: { stroke: '#eab308', strokeWidth: 1 },
      });
    });
  });

  // Create train nodes and connect to tracks
  trains.forEach((train) => {
    const trackPos = nodePositions.get(train.current_track);
    const position = trackPos
      ? { x: trackPos.x + 20, y: trackPos.y - 50 }
      : { x: 300, y: stationYBase + 50 };

    // Slightly offset if multiple trains on same track
    const trainsOnSameTrack = trains.filter((t) => t.current_track === train.current_track);
    if (trainsOnSameTrack.length > 1) {
      const idx = trainsOnSameTrack.findIndex((t) => t.train_number === train.train_number);
      position.x += idx * 30;
    }

    nodes.push({
      id: train.train_number,
      type: 'train',
      position,
      data: { train },
    });

    edges.push({
      id: `e-${train.train_number}-${train.current_track}`,
      source: train.current_track,
      target: train.train_number,
      type: 'straight',
      animated: train.status === 'RUNNING' || train.status === 'APPROACHING',
      style: {
        stroke: train.status === 'EMERGENCY' ? '#ef4444' : train.status === 'DELAYED' ? '#eab308' : '#22c55e',
        strokeWidth: 2,
      },
      className: train.status === 'RUNNING' ? 'occupied' : '',
    });
  });

  // Connect tracks to each other
  tracks.forEach((track) => {
    (track.connected_tracks || []).forEach((connectedId: string) => {
      if (nodePositions.has(track.track_id) && nodePositions.has(connectedId)) {
        edges.push({
          id: `e-${track.track_id}-${connectedId}`,
          source: track.track_id,
          target: connectedId,
          type: 'smoothstep',
          style: { stroke: '#2a3550', strokeWidth: 1 },
        });
      }
    });
  });

  return { nodes, edges };
}

export function RailwayMap({ fullScreen = false, onFullScreenToggle, className }: RailwayMapProps) {
  const { data: networkState, isLoading, error, refetch } = useNetworkStateQuery(5000);
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [fitView, setFitView] = useState(true);

  const onNodesChange = (changes: NodeChange<Node>[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  };

  const onEdgesChange = (changes: EdgeChange<Edge>[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  };

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!networkState) return { nodes: [], edges: [] };
    return generateNodesFromState(networkState);
  }, [networkState]);

  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Update train positions from store
  const trains = useTrainStore((s) => s.trains);
  useEffect(() => {
    if (trains.length === 0) return;
    setNodes((prev: Node[]) =>
      prev.map((node) => {
        if (node.type === 'train') {
          const train = trains.find((t) => t.train_number === node.id);
          if (train) {
            return {
              ...node,
              data: { ...node.data, train },
            };
          }
        }
        return node;
      })
    );
  }, [trains, setNodes]);

  // Update signal states from store
  const signalList = useSignalStore((s) => s.signals);
  useEffect(() => {
    if (signalList.length === 0) return;
    setNodes((prev: Node[]) =>
      prev.map((node) => {
        if (node.type === 'signal') {
          const signal = signalList.find((s) => s.signal_id === node.id);
          if (signal) {
            return {
              ...node,
              data: { ...node.data, signal },
            };
          }
        }
        return node;
      })
    );
  }, [signalList, setNodes]);

  if (isLoading && nodes.length === 0) {
    return (
      <div className={clsx('control-panel h-full min-h-[400px] flex items-center justify-center', className)}>
        <LoadingState message="Loading railway network..." />
      </div>
    );
  }

  if (error && nodes.length === 0) {
    return (
      <div className={clsx('control-panel h-full min-h-[400px] flex items-center justify-center', className)}>
        <ErrorState message="Failed to load railway network" onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={clsx('control-panel relative overflow-hidden', className)}
    >
      <div className="control-panel-header">
        <span className="control-panel-title flex items-center gap-2">
          <Eye className="w-4 h-4 text-rail-active" />
          Railway Network Map
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-rail-text-dim">
            {nodes.length} nodes · {edges.length} connections
          </span>
          <button
            onClick={onFullScreenToggle}
            className="p-1.5 rounded-md hover:bg-rail-surface text-rail-text-muted hover:text-rail-text transition-colors"
            title={fullScreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={clsx('w-full', fullScreen ? 'h-[calc(100vh-120px)]' : 'h-[500px]')}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView={fitView}
          onInit={() => setFitView(false)}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#1e293b"
          />
          <Controls
            className="!bg-rail-panel !border-rail-border"
            showInteractive={false}
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'station') return '#3b82f6';
              if (node.type === 'junction') return '#eab308';
              if (node.type === 'signal') return '#22c55e';
              if (node.type === 'train') return '#f97316';
              return '#374c6d';
            }}
            maskColor="#0a0e17cc"
            className="!bg-rail-panel !border-rail-border"
            style={{ backgroundColor: '#111827' }}
          />
          <Panel position="bottom-left" className="!m-2">
            <div className="bg-rail-panel/90 backdrop-blur border border-rail-border rounded-md px-2.5 py-1.5 flex items-center gap-3 text-[10px] text-rail-text-dim">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rail-active" /> Station
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-train-running" /> Train
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-signal-yellow" /> Junction
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rail-track" /> Track
              </span>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </motion.div>
  );
}
