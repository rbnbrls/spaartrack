export type CommunityVisibility = "PUBLIC" | "PRIVATE";
export type CommunityStatus = "VISIBLE" | "PRIVATE" | "PENDING" | "REJECTED" | "DELETED";

export type CommunityPost = {
  visibility: CommunityVisibility;
  status: CommunityStatus;
  title: string;
  body: string;
  public_metrics: Record<string, number>;
  calculation_version: "community-feed-v1";
  source: "community_post";
  read_only: true;
  created_at: string;
};

const SAFE_METRICS = new Set(["allocation_percent", "return_percent", "position_count"]);
const BLOCKED_CONTENT = /\b(spam|scam|guaranteed\s+profit|password|api[_ -]?key|secret)\b/i;

export function moderateCommunityPost(input: { visibility?: string; body?: string }): { status: CommunityStatus; reason?: string } {
  const visibility = String(input.visibility ?? "").trim().toUpperCase();
  if (visibility === "PRIVATE") return { status: "PRIVATE" };
  if (BLOCKED_CONTENT.test(String(input.body ?? ""))) return { status: "REJECTED", reason: "BLOCKED_CONTENT" };
  return { status: "VISIBLE" };
}

export function buildCommunityPost(input: { visibility?: string; title?: string; body?: string; public_metrics?: Record<string, unknown> }, createdAt: string): CommunityPost {
  const visibility = String(input.visibility ?? "").trim().toUpperCase() as CommunityVisibility;
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  const timestamp = new Date(createdAt);
  if (!["PUBLIC", "PRIVATE"].includes(visibility) || !title || title.length > 120 || !body || body.length > 4000 || Number.isNaN(timestamp.getTime())) throw new Error("INVALID_COMMUNITY_POST");
  const rawMetrics = input.public_metrics && typeof input.public_metrics === "object" ? input.public_metrics : {};
  const publicMetrics: Record<string, number> = {};
  for (const [key, value] of Object.entries(rawMetrics)) {
    if (!SAFE_METRICS.has(key) || typeof value !== "number" || !Number.isFinite(value)) throw new Error("PRIVATE_DATA_IN_PUBLIC_POST");
    publicMetrics[key] = value;
  }
  const moderation = moderateCommunityPost({ visibility, body });
  return { visibility, status: moderation.status, title, body, public_metrics: visibility === "PUBLIC" ? publicMetrics : {}, calculation_version: "community-feed-v1", source: "community_post", read_only: true, created_at: timestamp.toISOString() };
}

export function buildCommunityExport(posts: Array<{ id: string; visibility: CommunityVisibility; status: CommunityStatus; title: string; body: string; public_metrics?: Record<string, unknown> }>) {
  return {
    posts: posts.filter((post) => post.status !== "DELETED").map((post) => ({ id: post.id, visibility: post.visibility, status: post.status, title: post.title, body: post.body, public_metrics: post.visibility === "PUBLIC" ? post.public_metrics ?? {} : {} })),
    calculation_version: "community-export-v1",
    source: "community_post",
    read_only: true as const
  };
}
