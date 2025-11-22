/**
 * Reddit API Integration Tests
 * Tests type safety and integration with official Reddit API types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedditClient } from "../clients/reddit.js";
import type { RedditListing, RedditLink, RedditComment, RedditThing } from "../types/reddit.js";
import {
  mockRedditAuthResponse,
  mockRedditSearchResponse,
  mockRedditCommentsResponse,
  mockFrustrationPosts,
  isRedditListing,
  isRedditLink,
  isRedditComment,
} from "../__mocks__/reddit-responses.js";

describe("Reddit API Integration", () => {
  let client: RedditClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new RedditClient({
      clientId: "test-client",
      clientSecret: "test-secret",
    });
    client.fetchFn = mockFetch;
  });

  describe("Type Safety", () => {
    it("should correctly type OAuth2 token response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRedditAuthResponse),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRedditSearchResponse),
      });

      await client.search("test");

      const authCall = mockFetch.mock.calls[0];
      expect(authCall[0]).toBe("https://www.reddit.com/api/v1/access_token");

      // Type assertion - should compile without errors
      const tokenResponse: typeof mockRedditAuthResponse = mockRedditAuthResponse;
      expect(tokenResponse.access_token).toBeDefined();
      expect(tokenResponse.token_type).toBe("bearer");
      expect(tokenResponse.expires_in).toBeGreaterThan(0);
    });

    it("should correctly type Listing responses", () => {
      // Type check - RedditListing structure
      const listing: RedditListing<RedditLink> = mockRedditSearchResponse;

      expect(listing.kind).toBe("Listing");
      expect(listing.data.children).toBeInstanceOf(Array);
      expect(listing.data.after).toBeDefined();
      expect(listing.data.before).toBeDefined();

      // Validate with type guard
      expect(isRedditListing(listing)).toBe(true);
    });

    it("should correctly type Link (t3) data", () => {
      const linkThing = mockRedditSearchResponse.data.children[0];

      // Type assertions
      expect(linkThing.kind).toBe("t3");
      const link: RedditLink = linkThing.data as RedditLink;

      // Votable properties
      expect(link.score).toBeDefined();
      expect(link.ups).toBeDefined();
      expect(link.downs).toBeDefined();

      // Created properties
      expect(link.created).toBeDefined();
      expect(link.created_utc).toBeDefined();

      // Link-specific properties
      expect(link.title).toBeDefined();
      expect(link.author).toBeDefined();
      expect(link.subreddit).toBeDefined();
      expect(link.permalink).toBeDefined();
      expect(link.num_comments).toBeDefined();
      expect(link.is_self).toBeDefined();

      // Validate with type guard
      expect(isRedditLink(linkThing)).toBe(true);
    });

    it("should correctly type Comment (t1) data", () => {
      const commentListing = mockRedditCommentsResponse[1];
      const commentThing = commentListing.data.children[0];

      expect(commentThing.kind).toBe("t1");
      const comment: RedditComment = commentThing.data as RedditComment;

      // Comment-specific properties
      expect(comment.body).toBeDefined();
      expect(comment.author).toBeDefined();
      expect(comment.parent_id).toBeDefined();
      expect(comment.link_id).toBeDefined();
      expect(comment.permalink).toBeDefined();
      expect(comment.depth).toBeDefined();

      // Votable properties
      expect(comment.score).toBeDefined();

      // Created properties
      expect(comment.created_utc).toBeDefined();

      // Validate with type guard
      expect(isRedditComment(commentThing)).toBe(true);
    });
  });

  describe("Real-world Response Handling", () => {
    it("should handle search results with proper types", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditAuthResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditSearchResponse),
        });

      const result = await client.search("json formatter");

      expect(result.posts).toHaveLength(3);

      // Type-safe access to post properties
      const firstPost = result.posts[0];
      expect(firstPost.title).toContain("JSON formatter");
      expect(firstPost.subreddit).toBeDefined();
      expect(firstPost.score).toBeGreaterThan(0);

      // All posts should have required Link properties
      result.posts.forEach((post) => {
        expect(post.id).toBeDefined();
        expect(post.title).toBeDefined();
        expect(post.author).toBeDefined();
        expect(post.score).toBeDefined();
        expect(post.num_comments).toBeDefined();
        expect(post.created_utc).toBeDefined();
      });
    });

    it("should handle comment threads with proper types", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditAuthResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditCommentsResponse),
        });

      const comments = await client.getComments("abc123");

      expect(comments).toHaveLength(3);

      // Type-safe access to comment properties
      const firstComment = comments[0];
      expect(firstComment.body).toBeDefined();
      expect(firstComment.author).toBeDefined();
      expect(firstComment.score).toBeDefined();
      expect(firstComment.permalink).toBeDefined();

      // All comments should have required Comment properties
      comments.forEach((comment) => {
        expect(comment.id).toBeDefined();
        expect(comment.body).toBeDefined();
        expect(comment.author).toBeDefined();
        expect(comment.score).toBeDefined();
        expect(comment.created_utc).toBeDefined();
      });
    });

    it("should handle frustration signals with typed data", async () => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRedditAuthResponse),
      });

      // Mock multiple search requests (6 patterns × 1 subreddit)
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              kind: "Listing",
              data: {
                children: mockFrustrationPosts,
                dist: 2,
                after: null,
                before: null,
                modhash: "",
              },
            }),
        });
      }

      const signals = await client.findFrustrationSignals("image compressor", {
        subreddits: ["webdesign"],
        limit: 25,
      });

      expect(signals.frustrationCount).toBeGreaterThan(0);
      expect(signals.posts).toBeDefined();
      expect(signals.sampleQuotes).toBeDefined();

      // Type-safe access to posts
      signals.posts.forEach((post) => {
        // RedditPost type from our client
        expect(post.id).toBeDefined();
        expect(post.title).toBeDefined();
        expect(post.score).toBeGreaterThan(0);
        expect(post.permalink).toBeDefined();
      });
    });
  });

  describe("Type Guards", () => {
    it("should validate Listing structure", () => {
      const validListing = mockRedditSearchResponse;
      const invalidListing = { kind: "t3", data: {} };

      expect(isRedditListing(validListing)).toBe(true);
      expect(isRedditListing(invalidListing)).toBe(false);
    });

    it("should validate Link (t3) structure", () => {
      const validLink = mockRedditSearchResponse.data.children[0];
      const invalidLink = { kind: "t1", data: {} };

      expect(isRedditLink(validLink)).toBe(true);
      expect(isRedditLink(invalidLink)).toBe(false);
    });

    it("should validate Comment (t1) structure", () => {
      const validComment = mockRedditCommentsResponse[1].data.children[0];
      const invalidComment = { kind: "t3", data: {} };

      expect(isRedditComment(validComment)).toBe(true);
      expect(isRedditComment(invalidComment)).toBe(false);
    });
  });

  describe("Response Transformation", () => {
    it("should transform Reddit Link to simplified Post", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditAuthResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditSearchResponse),
        });

      const result = await client.search("test");

      // Verify transformation from RedditLink to RedditPost
      const post = result.posts[0];

      // Core fields preserved
      expect(post.id).toBe(mockRedditSearchResponse.data.children[0].data.id);
      expect(post.title).toBe(mockRedditSearchResponse.data.children[0].data.title);
      expect(post.author).toBe(mockRedditSearchResponse.data.children[0].data.author);
      expect(post.score).toBe(mockRedditSearchResponse.data.children[0].data.score);

      // Simplified fields
      expect(post.permalink).toContain("reddit.com");
      expect(post.subreddit).toBeDefined();
      expect(post.num_comments).toBeDefined();
      expect(post.created_utc).toBeDefined();
    });

    it("should transform Reddit Comment to simplified Comment", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditAuthResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditCommentsResponse),
        });

      const comments = await client.getComments("abc123");

      // Verify transformation
      const comment = comments[0];
      const sourceData = mockRedditCommentsResponse[1].data.children[0].data as RedditComment;

      expect(comment.id).toBe(sourceData.id);
      expect(comment.body).toBe(sourceData.body);
      expect(comment.author).toBe(sourceData.author);
      expect(comment.score).toBe(sourceData.score);
      expect(comment.permalink).toContain("reddit.com");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty listings", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditAuthResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              kind: "Listing",
              data: {
                children: [],
                dist: 0,
                after: null,
                before: null,
                modhash: "",
              },
            }),
        });

      const result = await client.search("nonexistent query");

      expect(result.posts).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    it("should handle deleted authors", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditAuthResponse),
        })
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
                      ...mockRedditSearchResponse.data.children[0].data,
                      author: "[deleted]",
                    },
                  },
                ],
                dist: 1,
                after: null,
                before: null,
                modhash: "",
              },
            }),
        });

      const result = await client.search("test");

      expect(result.posts[0].author).toBe("[deleted]");
    });

    it("should handle missing optional fields", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRedditAuthResponse),
        })
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
                      id: "minimal",
                      title: "Minimal post",
                      author: "user",
                      subreddit: "test",
                      score: 1,
                      ups: 1,
                      downs: 0,
                      likes: null,
                      created: Date.now() / 1000,
                      created_utc: Date.now() / 1000,
                      num_comments: 0,
                      permalink: "/r/test/comments/minimal",
                      url: "https://reddit.com",
                      domain: "reddit.com",
                      selftext: "",
                      // Many optional fields missing
                    },
                  },
                ],
                dist: 1,
                after: null,
                before: null,
                modhash: "",
              },
            }),
        });

      const result = await client.search("test");

      // Should still work with minimal data
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].title).toBe("Minimal post");
    });
  });
});
