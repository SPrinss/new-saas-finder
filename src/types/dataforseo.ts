/**
 * DataForSEO API Response Types
 * Based on official documentation: https://docs.dataforseo.com/v3/
 */

// ============ Common Response Structure ============

export interface DataForSEOResponse<T> {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: DataForSEOTask<T>[];
}

export interface DataForSEOTask<T> {
  id: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  result_count: number;
  path: string[];
  data: Record<string, unknown>;
  result: T[] | null;
}

// ============ Keyword Info ============

export interface KeywordInfo {
  se_type: string;
  last_updated_time: string;
  competition: number;
  competition_level: "LOW" | "MEDIUM" | "HIGH" | null;
  cpc: number;
  search_volume: number;
  low_top_of_page_bid: number;
  high_top_of_page_bid: number;
  categories: number[] | null;
  monthly_searches: MonthlySearch[] | null;
  search_volume_trend: SearchVolumeTrend | null;
}

export interface MonthlySearch {
  year: number;
  month: number;
  search_volume: number;
}

export interface SearchVolumeTrend {
  monthly: number;
  quarterly: number;
  yearly: number;
}

export interface KeywordProperties {
  se_type: string;
  core_keyword: string | null;
  synonym_clustering_algorithm: string | null;
  keyword_difficulty: number;
  detected_language: string | null;
  is_another_language: boolean;
}

export interface SearchIntentInfo {
  se_type: string;
  main_intent: "informational" | "navigational" | "commercial" | "transactional" | null;
  foreign_intent: string[] | null;
  last_updated_time: string;
}

export interface SerpInfo {
  se_type: string;
  check_url: string;
  serp_item_types: string[];
  se_results_count: number;
  last_updated_time: string;
  previous_updated_time: string;
}

// ============ Related Keywords Response ============

export interface RelatedKeywordsResult {
  se_type: string;
  seed_keyword: string;
  seed_keyword_data: SeedKeywordData | null;
  location_code: number;
  language_code: string;
  total_count: number;
  items_count: number;
  items: RelatedKeywordItem[] | null;
}

export interface SeedKeywordData {
  se_type: string;
  keyword: string;
  keyword_info: KeywordInfo;
  keyword_properties: KeywordProperties;
  serp_info: SerpInfo | null;
  search_intent_info: SearchIntentInfo | null;
}

export interface RelatedKeywordItem {
  se_type: string;
  keyword_data: KeywordData;
  depth: number;
  related_keywords: string[] | null;
}

export interface KeywordData {
  se_type: string;
  keyword: string;
  keyword_info: KeywordInfo;
  keyword_properties: KeywordProperties;
  serp_info: SerpInfo | null;
  search_intent_info: SearchIntentInfo | null;
}

// ============ Keyword Suggestions Response ============

export interface KeywordSuggestionsResult {
  se_type: string;
  seed_keyword: string;
  seed_keyword_data: SeedKeywordData | null;
  location_code: number;
  language_code: string;
  total_count: number;
  items_count: number;
  items: KeywordSuggestionItem[] | null;
}

export interface KeywordSuggestionItem {
  se_type: string;
  keyword_data: KeywordData;
  keyword_info: KeywordInfo;
  impressions_info: ImpressionsInfo | null;
  serp_info: SerpInfo | null;
  avg_backlinks_info: AvgBacklinksInfo | null;
  search_intent_info: SearchIntentInfo | null;
}

export interface ImpressionsInfo {
  se_type: string;
  last_updated_time: string;
  bid: number;
  match_type: string;
  ad_position_min: number;
  ad_position_max: number;
  ad_position_average: number;
  cpc_min: number;
  cpc_max: number;
  cpc_average: number;
  daily_impressions_min: number;
  daily_impressions_max: number;
  daily_impressions_average: number;
  daily_clicks_min: number;
  daily_clicks_max: number;
  daily_clicks_average: number;
  daily_cost_min: number;
  daily_cost_max: number;
  daily_cost_average: number;
}

export interface AvgBacklinksInfo {
  se_type: string;
  backlinks: number;
  dofollow: number;
  referring_pages: number;
  referring_domains: number;
  referring_main_domains: number;
  rank: number;
  main_domain_rank: number;
  last_updated_time: string;
}

// ============ SERP Response ============

export interface SerpResult {
  keyword: string;
  type: string;
  se_domain: string;
  location_code: number;
  language_code: string;
  check_url: string;
  datetime: string;
  spell: SpellInfo | null;
  refinement_chips: RefinementChips | null;
  item_types: string[];
  se_results_count: number;
  pages_count: number;
  items_count: number;
  items: SerpItem[] | null;
}

export interface SpellInfo {
  keyword: string;
  type: string;
}

export interface RefinementChips {
  items: RefinementChipItem[];
}

export interface RefinementChipItem {
  type: string;
  title: string;
  url: string;
  domain: string;
  options: unknown[];
}

export type SerpItem = OrganicSerpItem | PaidSerpItem | FeaturedSnippetItem | LocalPackItem | KnowledgeGraphItem;

export interface BaseSerpItem {
  type: string;
  rank_group: number;
  rank_absolute: number;
  position: string;
  xpath: string;
}

export interface OrganicSerpItem extends BaseSerpItem {
  type: "organic";
  domain: string;
  title: string;
  description: string;
  url: string;
  breadcrumb: string;
  is_image: boolean;
  is_video: boolean;
  is_featured_snippet: boolean;
  is_malicious: boolean;
  is_web_story: boolean;
  amp_version: boolean;
  rating: Rating | null;
  links: SiteLink[] | null;
  about_this_result: AboutThisResult | null;
  main_domain: string;
  relative_url: string;
  cached_pages: string | null;
  related_search_url: string | null;
  etv: number;
  impressions_etv: number;
  estimated_paid_traffic_cost: number;
  rank_changes: RankChanges | null;
  backlinks_info: BacklinksInfo | null;
  rank_info: RankInfo | null;
}

export interface PaidSerpItem extends BaseSerpItem {
  type: "paid";
  domain: string;
  title: string;
  description: string;
  url: string;
  breadcrumb: string;
}

export interface FeaturedSnippetItem extends BaseSerpItem {
  type: "featured_snippet";
  domain: string;
  title: string;
  description: string;
  url: string;
}

export interface LocalPackItem extends BaseSerpItem {
  type: "local_pack";
  title: string;
  description: string;
  domain: string;
  url: string;
  rating: Rating | null;
}

export interface KnowledgeGraphItem extends BaseSerpItem {
  type: "knowledge_graph";
  title: string;
  description: string;
  url: string;
}

export interface Rating {
  rating_type: string;
  value: number;
  votes_count: number;
  rating_max: number;
}

export interface SiteLink {
  type: string;
  title: string;
  description: string;
  url: string;
}

export interface AboutThisResult {
  type: string;
  url: string;
  source: string;
  source_info: string;
  source_url: string;
  language: string;
  location: string;
  search_terms: string[];
  related_terms: string[];
}

export interface RankChanges {
  previous_rank_absolute: number;
  is_new: boolean;
  is_up: boolean;
  is_down: boolean;
}

export interface BacklinksInfo {
  referring_domains: number;
  referring_main_domains: number;
  referring_pages: number;
  dofollow: number;
  backlinks: number;
  time_update: string;
}

export interface RankInfo {
  page_rank: number;
  main_domain_rank: number;
}

// ============ Backlinks Summary Response ============

export interface BacklinksSummaryResult {
  target: string;
  first_seen: string;
  lost_date: string | null;
  rank: number;
  backlinks: number;
  backlinks_spam_score: number;
  crawled_pages: number;
  info: DomainInfo | null;
  internal_links_count: number;
  external_links_count: number;
  broken_backlinks: number;
  broken_pages: number;
  referring_domains: number;
  referring_domains_nofollow: number;
  referring_main_domains: number;
  referring_main_domains_nofollow: number;
  referring_ips: number;
  referring_subnets: number;
  referring_pages: number;
  referring_pages_nofollow: number;
  referring_links_tld: Record<string, number> | null;
  referring_links_types: ReferringLinksTypes | null;
  referring_links_attributes: ReferringLinksAttributes | null;
  referring_links_platform_types: Record<string, number> | null;
  referring_links_semantic_locations: Record<string, number> | null;
  referring_links_countries: Record<string, number> | null;
}

export interface DomainInfo {
  server: string | null;
  cms: string | null;
  platform_type: string[] | null;
  ip_address: string | null;
  country: string | null;
  is_ip: boolean;
  target_spam_score: number;
}

export interface ReferringLinksTypes {
  anchor: number;
  alternate: number;
  canonical: number;
  image: number;
  form: number;
  redirect: number;
}

export interface ReferringLinksAttributes {
  nofollow: number;
  noopener: number;
  noreferrer: number;
  external: number;
  ugc: number;
  sponsored: number;
}

// ============ Type aliases for cleaner imports ============

export type RelatedKeywordsResponse = DataForSEOResponse<RelatedKeywordsResult>;
export type KeywordSuggestionsResponse = DataForSEOResponse<KeywordSuggestionsResult>;
export type SerpResponse = DataForSEOResponse<SerpResult>;
export type BacklinksSummaryResponse = DataForSEOResponse<BacklinksSummaryResult>;
