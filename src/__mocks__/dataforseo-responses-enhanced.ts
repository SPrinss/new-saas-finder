/**
 * Comprehensive DataForSEO API Mock Responses
 * Based on official DataForSEO API v3 documentation
 * https://docs.dataforseo.com/v3/
 */

import type {
  DataForSEOResponse,
  RelatedKeywordsResult,
  SerpResult,
  BacklinksSummaryResult,
  KeywordInfo,
  KeywordProperties,
  SearchIntentInfo,
  SerpInfo,
  OrganicSerpItem,
  BacklinksInfo,
  RankInfo,
} from "../types/dataforseo.js";

// ============ Keyword Info Mock Data ============

export const mockKeywordInfo: KeywordInfo = {
  se_type: "google",
  last_updated_time: "2024-11-20 10:30:00 +00:00",
  competition: 0.25,
  competition_level: "LOW",
  cpc: 1.85,
  search_volume: 5400,
  low_top_of_page_bid: 0.95,
  high_top_of_page_bid: 3.2,
  categories: [10019, 10166],
  monthly_searches: [
    { year: 2024, month: 10, search_volume: 5200 },
    { year: 2024, month: 9, search_volume: 5100 },
    { year: 2024, month: 8, search_volume: 4900 },
    { year: 2024, month: 7, search_volume: 4800 },
    { year: 2024, month: 6, search_volume: 5000 },
    { year: 2024, month: 5, search_volume: 5300 },
  ],
  search_volume_trend: {
    monthly: 2.35,
    quarterly: 7.85,
    yearly: 15.42,
  },
};

export const mockKeywordProperties: KeywordProperties = {
  se_type: "google",
  core_keyword: "json formatter",
  synonym_clustering_algorithm: "keyword_metrics",
  keyword_difficulty: 28,
  detected_language: "en",
  is_another_language: false,
};

export const mockSearchIntentInfo: SearchIntentInfo = {
  se_type: "google",
  main_intent: "transactional",
  foreign_intent: ["informational"],
  last_updated_time: "2024-11-20 10:30:00 +00:00",
};

export const mockSerpInfo: SerpInfo = {
  se_type: "google",
  check_url: "https://www.google.com/search?q=json+formatter+online",
  serp_item_types: ["organic", "people_also_ask", "related_searches"],
  se_results_count: 12500000,
  last_updated_time: "2024-11-20 10:30:00 +00:00",
  previous_updated_time: "2024-11-15 08:20:00 +00:00",
};

// ============ Related Keywords Response ============

export const mockRelatedKeywordsResponse: DataForSEOResponse<RelatedKeywordsResult> = {
  version: "0.1.20241104",
  status_code: 20000,
  status_message: "Ok.",
  time: "1.2345 sec.",
  cost: 0.0075,
  tasks_count: 1,
  tasks_error: 0,
  tasks: [
    {
      id: "11221122-1122-1122-1122-112211221122",
      status_code: 20000,
      status_message: "Ok.",
      time: "1.2345 sec.",
      cost: 0.0075,
      result_count: 1,
      path: ["v3", "dataforseo_labs", "google", "related_keywords", "live"],
      data: {
        api: "dataforseo_labs",
        function: "related_keywords",
        se_type: "google",
        keyword: "json formatter online",
        location_code: 2840,
        language_code: "en",
      },
      result: [
        {
          se_type: "google",
          seed_keyword: "json formatter online",
          seed_keyword_data: null,
          location_code: 2840,
          language_code: "en",
          total_count: 1250,
          items_count: 100,
          items: [
            {
              se_type: "google",
              keyword_data: {
                se_type: "google",
                keyword: "json formatter online",
                keyword_info: mockKeywordInfo,
                keyword_properties: mockKeywordProperties,
                serp_info: mockSerpInfo,
                search_intent_info: mockSearchIntentInfo,
              },
              depth: 0,
              related_keywords: ["json beautifier", "json validator", "pretty json"],
            },
            {
              se_type: "google",
              keyword_data: {
                se_type: "google",
                keyword: "json beautifier",
                keyword_info: {
                  ...mockKeywordInfo,
                  search_volume: 3200,
                  cpc: 1.45,
                  competition_level: "LOW",
                },
                keyword_properties: {
                  ...mockKeywordProperties,
                  core_keyword: "json beautifier",
                  keyword_difficulty: 22,
                },
                serp_info: mockSerpInfo,
                search_intent_info: mockSearchIntentInfo,
              },
              depth: 1,
              related_keywords: null,
            },
            {
              se_type: "google",
              keyword_data: {
                se_type: "google",
                keyword: "json validator online",
                keyword_info: {
                  ...mockKeywordInfo,
                  search_volume: 4100,
                  cpc: 1.65,
                  competition_level: "LOW",
                },
                keyword_properties: {
                  ...mockKeywordProperties,
                  core_keyword: "json validator",
                  keyword_difficulty: 25,
                },
                serp_info: mockSerpInfo,
                search_intent_info: mockSearchIntentInfo,
              },
              depth: 1,
              related_keywords: null,
            },
          ],
        },
      ],
    },
  ],
};

// ============ SERP Response ============

export const mockBacklinksInfo: BacklinksInfo = {
  referring_domains: 125,
  referring_main_domains: 98,
  referring_pages: 342,
  dofollow: 287,
  backlinks: 456,
  time_update: "2024-11-20 10:30:00 +00:00",
};

export const mockRankInfo: RankInfo = {
  page_rank: 35,
  main_domain_rank: 42,
};

export const mockOrganicItem: OrganicSerpItem = {
  type: "organic",
  rank_group: 1,
  rank_absolute: 1,
  position: "left",
  xpath: "/html/body/div[1]/div[3]/div[1]",
  domain: "jsonformatter.org",
  title: "JSON Formatter & Validator - Best Free Online Tool",
  description:
    "Format, validate and beautify your JSON data with our free online tool. Fast, reliable, and easy to use.",
  url: "https://jsonformatter.org/",
  breadcrumb: "jsonformatter.org",
  is_image: false,
  is_video: false,
  is_featured_snippet: false,
  is_malicious: false,
  is_web_story: false,
  amp_version: false,
  rating: {
    rating_type: "stars",
    value: 4.6,
    votes_count: 1230,
    rating_max: 5,
  },
  links: [
    {
      type: "sitelink",
      title: "JSON Validator",
      description: "Validate your JSON",
      url: "https://jsonformatter.org/validator",
    },
    {
      type: "sitelink",
      title: "Minify JSON",
      description: "Compress JSON data",
      url: "https://jsonformatter.org/minify",
    },
  ],
  about_this_result: {
    type: "about_this_result",
    url: "https://jsonformatter.org/about",
    source: "jsonformatter.org",
    source_info: "Online JSON tools and utilities",
    source_url: "https://jsonformatter.org",
    language: "en",
    location: "United States",
    search_terms: ["json", "formatter", "online"],
    related_terms: ["json validator", "json beautifier"],
  },
  main_domain: "jsonformatter.org",
  relative_url: "/",
  cached_pages: null,
  related_search_url: null,
  etv: 1250.5,
  impressions_etv: 1450.8,
  estimated_paid_traffic_cost: 125.75,
  rank_changes: {
    previous_rank_absolute: 2,
    is_new: false,
    is_up: true,
    is_down: false,
  },
  backlinks_info: mockBacklinksInfo,
  rank_info: mockRankInfo,
};

export const mockSerpResponse: DataForSEOResponse<SerpResult> = {
  version: "0.1.20241104",
  status_code: 20000,
  status_message: "Ok.",
  time: "2.1234 sec.",
  cost: 0.015,
  tasks_count: 1,
  tasks_error: 0,
  tasks: [
    {
      id: "33443344-3344-3344-3344-334433443344",
      status_code: 20000,
      status_message: "Ok.",
      time: "2.1234 sec.",
      cost: 0.015,
      result_count: 1,
      path: ["v3", "serp", "google", "organic", "live", "advanced"],
      data: {
        api: "serp",
        function: "live",
        se: "google",
        keyword: "json formatter online",
        location_code: 2840,
        language_code: "en",
      },
      result: [
        {
          keyword: "json formatter online",
          type: "google",
          se_domain: "google.com",
          location_code: 2840,
          language_code: "en",
          check_url: "https://www.google.com/search?q=json+formatter+online",
          datetime: "2024-11-20 10:30:00 +00:00",
          spell: null,
          refinement_chips: null,
          item_types: ["organic", "people_also_ask", "related_searches"],
          se_results_count: 12500000,
          pages_count: 100,
          items_count: 10,
          items: [
            mockOrganicItem,
            {
              ...mockOrganicItem,
              rank_absolute: 2,
              domain: "jsoneditoronline.org",
              title: "JSON Editor Online - View and edit JSON",
              url: "https://jsoneditoronline.org/",
              description: "Edit and format JSON with a simple interface",
              backlinks_info: {
                ...mockBacklinksInfo,
                referring_domains: 89,
                backlinks: 234,
              },
              rank_info: {
                page_rank: 28,
                main_domain_rank: 35,
              },
            },
            {
              ...mockOrganicItem,
              rank_absolute: 3,
              domain: "codebeautify.org",
              title: "Best JSON Formatter and Beautifier",
              url: "https://codebeautify.org/jsonviewer",
              description: "Format and beautify your JSON code instantly",
              backlinks_info: {
                ...mockBacklinksInfo,
                referring_domains: 67,
                backlinks: 189,
              },
              rank_info: {
                page_rank: 22,
                main_domain_rank: 29,
              },
            },
          ],
        },
      ],
    },
  ],
};

// ============ Backlinks Summary Response ============

export const mockBacklinksSummaryResponse: DataForSEOResponse<BacklinksSummaryResult> = {
  version: "0.1.20241104",
  status_code: 20000,
  status_message: "Ok.",
  time: "0.8765 sec.",
  cost: 0.005,
  tasks_count: 1,
  tasks_error: 0,
  tasks: [
    {
      id: "55665566-5566-5566-5566-556655665566",
      status_code: 20000,
      status_message: "Ok.",
      time: "0.8765 sec.",
      cost: 0.005,
      result_count: 1,
      path: ["v3", "backlinks", "summary", "live"],
      data: {
        api: "backlinks",
        function: "summary",
        target: "jsonformatter.org",
      },
      result: [
        {
          target: "jsonformatter.org",
          first_seen: "2018-03-15 12:00:00 +00:00",
          lost_date: null,
          rank: 42,
          backlinks: 456,
          backlinks_spam_score: 12,
          crawled_pages: 234,
          info: {
            server: "nginx/1.18.0",
            cms: null,
            platform_type: ["cms", "blogs"],
            ip_address: "104.21.45.123",
            country: "US",
            is_ip: false,
            target_spam_score: 8,
          },
          internal_links_count: 1234,
          external_links_count: 567,
          broken_backlinks: 23,
          broken_pages: 12,
          referring_domains: 125,
          referring_domains_nofollow: 18,
          referring_main_domains: 98,
          referring_main_domains_nofollow: 12,
          referring_ips: 87,
          referring_subnets: 65,
          referring_pages: 342,
          referring_pages_nofollow: 45,
          referring_links_tld: {
            com: 234,
            org: 89,
            net: 45,
            io: 23,
            dev: 15,
          },
          referring_links_types: {
            anchor: 389,
            alternate: 12,
            canonical: 8,
            image: 23,
            form: 5,
            redirect: 19,
          },
          referring_links_attributes: {
            nofollow: 45,
            noopener: 123,
            noreferrer: 156,
            external: 234,
            ugc: 12,
            sponsored: 8,
          },
          referring_links_platform_types: {
            cms: 234,
            blogs: 123,
            ecommerce: 45,
            message_boards: 23,
          },
          referring_links_semantic_locations: {
            article: 234,
            section: 123,
            nav: 45,
            footer: 34,
            aside: 20,
          },
          referring_links_countries: {
            US: 234,
            GB: 67,
            CA: 45,
            AU: 34,
            DE: 23,
          },
        },
      ],
    },
  ],
};

// ============ Error Responses ============

export const mockErrorResponse: DataForSEOResponse<never> = {
  version: "0.1.20241104",
  status_code: 40000,
  status_message: "Bad Request",
  time: "0.123 sec.",
  cost: 0,
  tasks_count: 0,
  tasks_error: 1,
  tasks: [],
};

export const mockAuthErrorResponse: DataForSEOResponse<never> = {
  version: "0.1.20241104",
  status_code: 40100,
  status_message: "Unauthorized. Invalid credentials",
  time: "0.056 sec.",
  cost: 0,
  tasks_count: 0,
  tasks_error: 1,
  tasks: [],
};

// ============ Empty/No Results Responses ============

export const mockEmptyRelatedKeywordsResponse: DataForSEOResponse<RelatedKeywordsResult> = {
  ...mockRelatedKeywordsResponse,
  tasks: [
    {
      ...mockRelatedKeywordsResponse.tasks[0],
      result: [
        {
          se_type: "google",
          seed_keyword: "xyznonexistentkeyword123",
          seed_keyword_data: null,
          location_code: 2840,
          language_code: "en",
          total_count: 0,
          items_count: 0,
          items: [],
        },
      ],
    },
  ],
};
