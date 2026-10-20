// Sends an ES|QL query and returns its rows.
import { errors, type Client } from "@elastic/elasticsearch";

/** Runs an ES|QL query and returns one object per row. An empty list means nothing matched. */
export async function runEsql<Row extends object>(client: Client, query: string): Promise<readonly Row[]> {
    try {
        const { records } = await client.helpers.esql({ query }).toRecords<Row>();
        return records;
    } catch (error) {
        throw explainError(error, query) 
    }
}

/** Builds an Error whose message says what went wrong and, when possible, what to do. */

function explainError(error: unknown, query: string): Error {
    if(error instanceof errors.ConnectionError){
        return new Error("Cannot reach Elasticsearch. Is it running? Try: docker compose up -d ", {cause: error});
    }

    if(error instanceof errors.ResponseError){
        return new Error(`Elasticsearch rejected the query: ${error.message}\nQuery: ${query}` , {cause: error});
    }

    return new Error(`ES|QL query failed: ${String(error)}\nQuery: ${query}`, { cause: error });
}