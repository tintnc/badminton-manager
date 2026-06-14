import fs from "node:fs/promises"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const dataFilePath = path.resolve(__dirname, "data", "badminton-data.json")

function emptyData() {
  return {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    members: [],
    sessions: [],
    transactions: [],
    shuttlecockBatches: [],
    settings: {
      monthlySupportFund: 3000000,
      defaultLocation: "Sân cầu lông C30",
      defaultStartTime: "19:00",
      defaultEndTime: "21:00",
      shuttlecockTubePrice: 300000,
      shuttlecocksPerTube: 12,
    },
  }
}

async function readRequestBody(request: NodeJS.ReadableStream) {
  let body = ""
  for await (const chunk of request) {
    body += chunk
  }
  return body
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "badminton-json-data",
      configureServer(server) {
        server.middlewares.use("/api/data", async (request, response) => {
          response.setHeader("Content-Type", "application/json; charset=utf-8")

          try {
            if (request.method === "GET") {
              try {
                response.end(await fs.readFile(dataFilePath, "utf-8"))
              } catch {
                response.end(JSON.stringify(emptyData(), null, 2))
              }
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
        })
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: ["badminton.binbin-enterprise.com"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
