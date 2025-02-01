export default {
  async fetch(request: Request): Promise<Response> {
    return new Response(
      JSON.stringify({ message: "Hello from HardestCarQuiz API!" }),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};
