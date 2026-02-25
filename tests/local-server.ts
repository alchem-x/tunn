Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello from tunnel!', {
      headers: { 'Content-Type': 'text/plain' },
    })
  },
})

console.log('Test server running on port 3000')
