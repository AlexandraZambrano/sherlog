// Creates the Elasticsearch client that the agent tools use to run queries.
import { Client } from "@elastic/elasticsearch";

/**
 * Creates an Elasticsearch client connected to the given address.
 *
 * The address is a parameter and is not read from the environment, so the function
 * has no hidden inputs and a test can point it at any server.
 *
 * @param url - Address of Elasticsearch, for example `http://localhost:9200`.
 * @returns A client ready to send requests to that server.
 */
export function createElasticClient(url: string): Client {
    return new Client({ node: url })
}