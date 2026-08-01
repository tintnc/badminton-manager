import fs from "node:fs/promises"
import path from "path"
import type { IncomingMessage, ServerResponse } from "node:http"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { emptyData } from "./src/core/config/defaults"

const dataFilePath = path.resolve(__dirname, "data", "badminton-data.json")
const exampleFilePath = path.resolve(__dirname, "data", "badminton-data.example.json")

async function readRequestBody(request: IncomingMessage) {
  let body = ""
  for await (const chunk of request) {
    body += chunk
  }
  return body
}

function createDataMiddleware() {
  return async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8")

    try {
      if (request.method === "GET") {
        let raw: string
        try {
          raw = await fs.readFile(dataFilePath, "utf-8")
        } catch {
          // Fresh clone: seed from the committed example file so the app is not empty.
          try {
            raw = await fs.readFile(exampleFilePath, "utf-8")
          } catch {
            raw = JSON.stringify(emptyData(), null, 2)
          }
        }
        response.end(raw)
        return
      }

      if (request.method === "PUT") {
        const body = await readRequestBody(request)
        const data = JSON.parse(body)
        await fs.mkdir(path.dirname(dataFilePath), { recursive: true })
        await fs.writeFile(
          dataFilePath,
          JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }, null, 2),
          "utf-8",
        )
        response.end(JSON.stringify({ ok: true }))
        return
      }

      if (request.method === "DELETE") {
        await fs.mkdir(path.dirname(dataFilePath), { recursive: true })
        await fs.writeFile(dataFilePath, JSON.stringify(emptyData(), null, 2), "utf-8")
        response.end(JSON.stringify({ ok: true }))
        return
      }

      response.statusCode = 405
      response.end(JSON.stringify({ error: "Method not allowed" }))
    } catch (error) {
      response.statusCode = 500
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }))
    }
  }
}

const dataMiddleware = createDataMiddleware()

const defaultAllowedHost = "badminton.binbin-enterprise.com"
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(",").map((host) => host.trim()).filter(Boolean)
  : [defaultAllowedHost]

export default defineConfig({
  plugins: [
    react(),
    {
      name: "badminton-json-data",
      configureServer(server) {
        server.middlewares.use("/api/data", dataMiddleware)
      },
      configurePreviewServer(server) {
        server.middlewares.use("/api/data", dataMiddleware)
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
