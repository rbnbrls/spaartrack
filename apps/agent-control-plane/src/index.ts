const release = process.env.APP_RELEASE || "local";

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: "info",
  service: "agent-control-plane",
  release,
  operation: "control_plane_started",
  mode: "guarded-bootstrap",
  permissions: ["read", "propose", "execute-sandbox"]
}));

setInterval(() => undefined, 30000);
