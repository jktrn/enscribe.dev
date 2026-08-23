const ENDPOINT = "https://api.github.com/graphql"

const AUTHOR = "author { login url avatarUrl }"
const FIELDS = `id url createdAt bodyHTML ${AUTHOR}`

const QUERY = `query($search: String!) {
  search(type: DISCUSSION, query: $search, first: 5) {
    nodes {
      ... on Discussion {
        title
        url
        comments(first: 100) {
          nodes {
            ${FIELDS}
            replies(first: 100) { nodes { ${FIELDS} } }
          }
        }
      }
    }
  }
}`

export type Author = {
  login: string
  url: string
  avatarUrl: string
}

export type Comment = {
  id: string
  url: string
  createdAt: string
  bodyHTML: string
  author: Author | null
  replies: Comment[]
}

export type Discussion = {
  url: string | null
  total: number
  comments: Comment[]
}

type RawComment = Omit<Comment, "replies"> & {
  replies?: { nodes: RawComment[] }
}

type RawResponse = {
  data?: {
    search?: {
      nodes?: ({
        title: string
        url: string
        comments: { nodes: RawComment[] }
      } | null)[]
    }
  }
  errors?: { message: string }[]
}

function normalize(raw: RawComment): Comment {
  const { replies, ...rest } = raw
  return { ...rest, replies: (replies?.nodes ?? []).map(normalize) }
}

export async function fetchDiscussion(options: {
  token: string
  repo: string
  category: string
  term: string
}): Promise<Discussion> {
  const { token, repo, category, term } = options
  const search = `repo:${repo} category:"${category}" in:title "${term}"`

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "enscribe.dev",
    },
    body: JSON.stringify({ query: QUERY, variables: { search } }),
  })

  if (!response.ok) {
    throw new Error(`GitHub responded ${response.status} for "${term}"`)
  }

  const payload = (await response.json()) as RawResponse
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "))
  }

  const match = payload.data?.search?.nodes?.find(
    (node) => node?.title === term,
  )
  if (!match) return { url: null, total: 0, comments: [] }

  const comments = match.comments.nodes.map(normalize)
  const total = comments.length
  return { url: match.url, total, comments }
}
