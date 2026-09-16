import { defineLeafCategories } from "@shared/core";

/**
 * LEAF category registry — the CLOSED vocabulary for `meta.categories`.
 *
 * Endpoints author ONLY these ids; an unknown id fails compilation. Adding a
 * leaf = editing this file in the same PR as the endpoint that needs it.
 *
 * This is the whole taxonomy story in this repo (v1 round-4 model): TOP groups
 * ("Search & SEO"), provider placement, and visibility are HOSTED concerns —
 * the Catalog manifest links leaves under tops at query time; the provider
 * tier is derived from ProviderDocs. Never authored here.
 */
export const LEAF_CATEGORIES = defineLeafCategories([
    {
        id: "web-search",
        displayName: "Web Search",
        description:
            "Search the open web — keyword, neural, and hybrid retrieval.",
    },
    {
        id: "web-scraping",
        displayName: "Web Scraping",
        description: "Fetch and extract clean content from known URLs.",
    },
    {
        id: "news-search",
        displayName: "News Search",
        description: "Search and monitor news coverage.",
    },
    {
        id: "company-enrichment",
        displayName: "Company Enrichment",
        description:
            "Company data: identity resolution, firmographics, and enrichment.",
    },
    {
        id: "company-news",
        displayName: "Company News",
        description:
            "Company event signals — funding, M&A, leadership, products.",
    },
    {
        id: "company-reviews",
        displayName: "Company Reviews",
        description: "Employee and product review data for companies.",
    },
    {
        id: "funding-data",
        displayName: "Funding Data",
        description: "Fundraising, investors, valuations, and deal activity.",
    },
    {
        id: "embeddings",
        displayName: "Embeddings",
        description: "Convert text and media into vector representations.",
    },
    {
        id: "people-enrichment",
        displayName: "People Enrichment",
        description:
            "Person data: profiles, contact discovery, and enrichment.",
    },
    {
        id: "linkedin",
        displayName: "LinkedIn",
        description: "LinkedIn data: profiles, jobs, posts, and companies.",
    },
    {
        id: "instagram",
        displayName: "Instagram",
        description: "Instagram data: profiles, posts, and hashtags.",
    },
    {
        id: "twitter",
        displayName: "X (Twitter)",
        description: "X (Twitter) data: tweets, profiles, and searches.",
    },
    {
        id: "youtube",
        displayName: "YouTube",
        description:
            "YouTube data: videos, transcripts, comments, and channels.",
    },
    {
        id: "maps",
        displayName: "Maps & Local",
        description:
            "Maps and local-places data: businesses, reviews, and points of interest.",
    },
    {
        id: "amazon",
        displayName: "Amazon",
        description:
            "Amazon data: products, reviews, search results, and sellers.",
    },
    {
        id: "facebook",
        displayName: "Facebook",
        description:
            "Facebook data: pages, groups, events, ads, posts, and reviews.",
    },
    {
        id: "google-shopping",
        displayName: "Google Shopping",
        description: "Google Shopping data: products, prices, and sellers.",
    },
    {
        id: "jobs",
        displayName: "Jobs",
        description: "Job listings and hiring data.",
    },
    {
        id: "reddit",
        displayName: "Reddit",
        description: "Reddit data: posts, comments, and communities.",
    },
    {
        id: "snapchat",
        displayName: "Snapchat",
        description: "Snapchat data: profiles, stories, and spotlight videos.",
    },
    {
        id: "tiktok",
        displayName: "TikTok",
        description:
            "TikTok data: videos, profiles, comments, and search results.",
    },
    {
        id: "agents",
        displayName: "Agents",
        description:
            "Hosted multi-step research agents that plan, search, and synthesize.",
    },
    {
        // The GENERATIVE leaves: every other id above names data that
        // already exists somewhere and is retrieved. These name an artifact
        // the call creates.
        id: "video-generation",
        displayName: "Video Generation",
        description:
            "Generate video from a text prompt, a still image, or reference " +
            "clips.",
    },
    {

        id: "3d-generation",
        displayName: "3D Generation",
        description:
            "Generate production 3D meshes from text prompts and photos.",
    },
    {
        id: "image-generation",
        displayName: "Image Generation",
        description:
            "Generate images, including text-to-image, editing, and more.",
    },
    {
        id: "music-generation",
        displayName: "Music Generation",
        description:
            "Generate music, including full tracks from natural language, and more.",
    },
    {
        id: "speech",
        displayName: "Speech",
        description:
            "Work with voice, including text-to-speech, transcription, dialogue, and more.",
    },
]);
