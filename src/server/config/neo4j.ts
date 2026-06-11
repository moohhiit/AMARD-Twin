import neo4j, { Driver, Session } from "neo4j-driver";
import logger from "../utils/logger";

let driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
    const user = process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD || "password";
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    logger.info("Neo4j driver initialized");
  }
  return driver;
}

export async function initNeo4j(): Promise<void> {
  const d = getNeo4jDriver();
  const session = d.session();
  try {
    await session.run(
      `CREATE CONSTRAINT station_id IF NOT EXISTS FOR (s:Station) REQUIRE s.id IS UNIQUE`
    );
    await session.run(
      `CREATE CONSTRAINT junction_id IF NOT EXISTS FOR (j:Junction) REQUIRE j.id IS UNIQUE`
    );
    logger.info("Neo4j constraints created");
  } catch (err) {
    logger.warn({ err }, "Neo4j constraints may already exist");
  } finally {
    await session.close();
  }
}

export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    logger.info("Neo4j driver closed");
  }
}

export function neo4jSession(): Session {
  return getNeo4jDriver().session();
}
