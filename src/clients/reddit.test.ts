import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedditClient, type RedditPost } from "./reddit.js";

describe("RedditClient", () => {
  let client: RedditClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new RedditClient({
      clientId: "test-client-id",
      clientSecret: "test-secret",
    });
    client.fetchFn = mockFetch;
  });

  describe("Authentication", () => {
    it("should authenticate with OAuth2", async () => {
      // Mock auth response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "test-token",
            token_type: "bearer",
            expires_in: 3600,
            scope: "*",
          }),
      });

      // Mock search response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            kind: "Listing",
            data: {
              children: [],
              dist: 0,
              after: null,
              before: null,
            },
          }),
      });

      await client.search("test query");

      // Check auth request
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.reddit.com/api/v1/access_token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic"),
          }),
        })
      );
    });

    it("should throw error on auth failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(client.search("test")).rejects.toThrow("Reddit auth failed: 401");
    });

    it("should reuse valid token", async () => {
      // First auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "token1",
            token_type: "bearer",
            expires_in: 3600,
            scope: "*",
          }),
      });

      // First search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ kind: "Listing", data: { children: [], dist: 0 } }),
      });

      // Second search (should not re-auth)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ kind: "Listing", data: { children: [], dist: 0 } }),
      });

      await client.search("query1");
      await client.search("query2");

      // Should only have 1 auth call + 2 search calls = 3 total
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Search", () => {
    beforeEach(() => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "test-token",
            expires_in: 3600,
          }),
      });
    });

    it("should search for posts", async () => {
      const mockPost = {
        id: "abc123",
        title: "Test Post",
        selftext: "Test content",
        author: "testuser",
        subreddit: "webdev",
        score: 100,
        num_comments: 50,
        created_utc: 1700000000,
        permalink: "/r/webdev/comments/abc123/test_post/",
        url: "https://reddit.com/r/webdev/comments/abc123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            kind: "Listing",
            data: {
              children: [
                {
                  kind: "t3",
                  data: mockPost,
                },
              ],
              dist: 1,
              after: null,
              before: null,
            },
          }),
      });

      const result = await client.search("test query");

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].id).toBe("abc123");
      expect(result.posts[0].title).toBe("Test Post");
      expect(result.totalResults).toBe(1);
    });

    it("should support search options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            kind: "Listing",
            data: { children: [], dist: 0 },
          }),
      });

      await client.search("test", {
        subreddit: "programming",
        sort: "top",
        timeFilter: "week",
        limit: 50,
      });

      const searchCall = mockFetch.mock.calls[1]; // Second call (first is auth)
      const url = searchCall[0] as string;

      expect(url).toContain("r/programming/search");
      expect(url).toContain("sort=top");
      expect(url).toContain("t=week");
      expect(url).toContain("limit=50");
    });

    it("should filter non-post items", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            kind: "Listing",
            data: {
              children: [
                { kind: "t3", data: { id: "post1", title: "Post" } }, // Valid post
                { kind: "t1", data: { id: "comment1" } }, // Comment (should be filtered)
                { kind: "t3", data: { id: "post2", title: "Post 2" } }, // Valid post
              ],
              dist: 2,
            },
          }),
      });

      const result = await client.search("test");

      expect(result.posts).toHaveLength(2);
      expect(result.posts[0].id).toBe("post1");
      expect(result.posts[1].id).toBe("post2");
    });
  });

  describe("Frustration Signals", () => {
    beforeEach(() => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "token", expires_in: 3600 }),
      });
    });

    it("should find frustration signals", async () => {
      // Mock multiple search responses (one per pattern)
      for (let i = 0; i < 6; i++) {
        // 6 patterns
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              kind: "Listing",
              data: {
                children: [
                  {
                    kind: "t3",
                    data: {
                      id: `post${i}`,
                      title: "I wish there was a better tool for this",
                      selftext: "I'm looking for a solution to...",
                      author: "user",
                      subreddit: "webdev",
                      score: 50,
                      num_comments: 10,
                      created_utc: 1700000000,
                      permalink: "/r/webdev/comments/post1/",
                      url: "https://reddit.com",
                    },
                  },
                ],
                dist: 1,
              },
            }),
        });
      }

      const result = await client.findFrustrationSignals("json formatter", {
        subreddits: ["webdev"],
        limit: 25,
      });

      expect(result.frustrationCount).toBeGreaterThan(0);
      expect(result.sampleQuotes.length).toBeGreaterThan(0);
      expect(result.posts.length).toBeGreaterThan(0);
    });

    it("should extract relevant quotes", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              kind: "Listing",
              data: {
                children: [
                  {
                    kind: "t3",
                    data: {
                      id: "1",
                      title: "Wish there was a better way",
                      selftext: "I need a tool for this task",
                      score: 100,
                    },
                  },
                ],
                dist: 1,
              },
            }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ kind: "Listing", data: { children: [], dist: 0 } }),
        });

      const result = await client.findFrustrationSignals("test tool", {
        subreddits: ["webdev"],
      });

      expect(result.sampleQuotes).toContain("Wish there was a better way");
      expect(result.sampleQuotes.some((q) => q.includes("need"))).toBe(true);
    });

    it("should deduplicate posts", async () => {
      const duplicatePost = {
        id: "same-id",
        title: "Test",
        selftext: "Content",
        score: 50,
      };

      // Return same post multiple times
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            kind: "Listing",
            data: {
              children: [{ kind: "t3", data: duplicatePost }],
              dist: 1,
            },
          }),
      });

      const result = await client.findFrustrationSignals("test", {
        subreddits: ["webdev"],
      });

      // Should deduplicate by ID
      const uniqueIds = new Set(result.posts.map((p) => p.id));
      expect(uniqueIds.size).toBe(result.posts.length);
    });

    it("should sort posts by score", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              kind: "Listing",
              data: {
                children: [
                  { kind: "t3", data: { id: "1", title: "Low", score: 10 } },
                  { kind: "t3", data: { id: "2", title: "High", score: 100 } },
                  { kind: "t3", data: { id: "3", title: "Medium", score: 50 } },
                ],
                dist: 3,
              },
            }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ kind: "Listing", data: { children: [], dist: 0 } }),
        });

      const result = await client.findFrustrationSignals("test", {
        subreddits: ["webdev"],
      });

      expect(result.posts[0].score).toBeGreaterThanOrEqual(result.posts[1]?.score || 0);
    });
  });

  describe("Get Comments", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "token", expires_in: 3600 }),
      });
    });

    it("should fetch comments for a post", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              // Post listing
              kind: "Listing",
              data: { children: [] },
            },
            {
              // Comments listing
              kind: "Listing",
              data: {
                children: [
                  {
                    kind: "t1",
                    data: {
                      id: "comment1",
                      body: "Great post!",
                      author: "user1",
                      score: 25,
                      created_utc: 1700000000,
                      permalink: "/r/test/comments/abc/test/comment1",
                    },
                  },
                ],
              },
            },
          ]),
      });

      const comments = await client.getComments("abc123");

      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe("comment1");
      expect(comments[0].body).toBe("Great post!");
      expect(comments[0].score).toBe(25);
    });

    it("should handle posts with no comments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            { kind: "Listing", data: { children: [] } },
            { kind: "Listing", data: { children: [] } },
          ]),
      });

      const comments = await client.getComments("abc123");

      expect(comments).toHaveLength(0);
    });

    it("should filter non-comment items", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            { kind: "Listing", data: { children: [] } },
            {
              kind: "Listing",
              data: {
                children: [
                  { kind: "t1", data: { id: "c1", body: "Comment" } }, // Valid
                  { kind: "more", data: { id: "more" } }, // Invalid (load more button)
                  { kind: "t1", data: { id: "c2", body: "Comment 2" } }, // Valid
                ],
              },
            },
          ]),
      });

      const comments = await client.getComments("abc123");

      expect(comments).toHaveLength(2);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "token", expires_in: 3600 }),
      });
    });

    it("should handle search failures gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(client.search("test")).rejects.toThrow("Reddit search failed: 500");
    });

    it("should handle comment fetch failures", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(client.getComments("nonexistent")).rejects.toThrow(
        "Failed to fetch comments: 404"
      );
    });
  });
});
