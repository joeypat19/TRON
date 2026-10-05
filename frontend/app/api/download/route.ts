import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const installerName = "TRON-0.1.2-Setup.exe";

export async function GET() {
  const installerPath = path.resolve(process.cwd(), "..", "desktop", "dist", installerName);

  try {
    await access(installerPath);
    const fileStats = await stat(installerPath);
    const stream = Readable.toWeb(createReadStream(installerPath)) as ReadableStream;

    return new Response(stream, {
      headers: {
        "Content-Type": "application/vnd.microsoft.portable-executable",
        "Content-Disposition": `attachment; filename="${installerName}"`,
        "Content-Length": String(fileStats.size),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "The TRON Windows installer has not been built yet." },
      { status: 404 },
    );
  }
}
