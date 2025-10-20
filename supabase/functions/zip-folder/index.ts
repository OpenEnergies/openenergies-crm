// supabase/functions/zip-folder/index.ts
// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ZipWriter } from 'https://deno.land/x/zipjs@v2.7.63/index.js';
import { corsHeaders } from '../_shared/cors.ts';

const BUCKET = 'documentos';
const PLACEHOLDER = '.emptyFolderPlaceholder';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const clienteId = url.searchParams.get('clienteId') ?? '';
    const path = url.searchParams.get('path') ?? '';
    const folder = url.searchParams.get('folder') ?? '';

    if (!clienteId || !folder) {
      return jsonError(400, 'Missing required params: clienteId, folder');
    }

    // Basic sanitization (avoid traversal / weird chars)
    const safe = (s: string) => s.replace(/[^a-zA-Z0-9._\/-]/g, '_').replace(/\/+/g, '/');
    const safeCliente = safe(clienteId);
    const safePath = safe(path);
    const safeFolder = safe(folder);

    const root = [
      'clientes',
      safeCliente,
      safePath, // may be ''
      safeFolder,
    ]
      .filter(Boolean)
      .join('/');

    // Build supabase client using the caller's JWT so Storage policies apply
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') ?? '',
        },
      },
    });

    // Helper: recursively collect file paths inside a folder
    async function listAllFiles(prefix: string): Promise<string[]> {
      const { data: items, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
      if (error) throw error;

      let acc: string[] = [];
      for (const item of items ?? []) {
        if (item.name === PLACEHOLDER) continue;
        const isFile = Boolean((item as any).id);
        const full = `${prefix}/${item.name}`;
        if (isFile) {
          acc.push(full);
        } else {
          const sub = await listAllFiles(full);
          acc = acc.concat(sub);
        }
      }
      return acc;
    }

    // Create a stream for the ZIP response and write into it progressively
    const stream = new TransformStream();
    const writer = new ZipWriter(stream.writable, { zip64: true }); // zip64 for >4GB safety

    // Start zipping asynchronously while we return the readable part to the client
    (async () => {
      try {
        const files = await listAllFiles(root);
        // If the folder is "empty" (no real files), produce an empty zip
        for (const fullPath of files) {
          const { data, error } = await supabase.storage.from(BUCKET).download(fullPath);
          if (error) throw error;

          // data is a Blob in Deno runtime; get a ReadableStream
          // Use relative path inside the zip (preserve sub-structure under folder)
          const relative = fullPath.slice(root.length + 1);
          const readable = (data as Blob).stream();
          await writer.add(relative, readable, { level: 0 }); // level 0 = fastest, tweak if you want compression
        }
      } catch (err) {
        console.error('ZIP error:', err);
      } finally {
        await writer.close();
      }
    })();

    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFolder)}.zip"`,
      ...corsHeaders,
    });

    return new Response(stream.readable, { headers });
  } catch (e) {
    console.error(e);
    return jsonError(500, 'Internal error while creating zip');
  }
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
