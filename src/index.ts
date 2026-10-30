export default {
  async fetch(_req: Request, _env: Env): Promise<Response> {
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
