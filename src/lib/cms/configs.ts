// Entity CRUD configurations shared by the /api/admin/* routes.
import type { CrudConfig } from './crud';

export const bannersCfg: CrudConfig = {
  entity: 'banners',
  label: 'banner',
  searchFields: ['title_html', 'subtitle'],
  defaultOrder: { column: 'display_order', ascending: true },
  editable: [
    'title_html', 'subtitle', 'desktop_media_id', 'mobile_media_id',
    'cta_label', 'cta_url', 'cta_style', 'display_order',
    'publish_at', 'unpublish_at',
  ],
  duplicateFields: ['title_html', 'subtitle', 'desktop_media_id', 'mobile_media_id', 'cta_label', 'cta_url', 'cta_style'],
  versionable: true,
  cacheTags: ['banners', 'home'],
  titleField: 'title_html',
};

export const announcementsCfg: CrudConfig = {
  entity: 'announcements',
  label: 'announcement',
  searchFields: ['title', 'description'],
  defaultOrder: { column: 'priority', ascending: false },
  editable: [
    'kind', 'title', 'description', 'icon', 'theme',
    'button_label', 'button_url', 'priority',
    'publish_at', 'unpublish_at', 'dismissible', 'locations',
  ],
  versionable: true,
  cacheTags: ['announcements', 'home', 'pricing', 'help'],
  titleField: 'title',
};

export const blogCfg: CrudConfig = {
  entity: 'blog_posts',
  label: 'blog post',
  searchFields: ['title', 'excerpt'],
  defaultOrder: { column: 'publish_at', ascending: false },
  editable: ['title', 'excerpt', 'content_md', 'category_id', 'featured_image_id', 'related_post_ids', 'publish_at'],
  versionable: true,
  cacheTags: ['blog'],
  titleField: 'title',
};

export const kbCfg: CrudConfig = {
  entity: 'kb_articles',
  label: 'KB article',
  searchFields: ['title', 'summary'],
  defaultOrder: { column: 'updated_at', ascending: false },
  editable: [
    'kind', 'title', 'summary', 'content_md', 'category_id', 'module',
    'tags', 'keywords', 'difficulty', 'product_version', 'featured_image_id',
    'related_article_ids', 'publish_at',
  ],
  versionable: true,
  cacheTags: ['help', 'kb'],
  titleField: 'title',
};

export const locationCfg: CrudConfig = {
  entity: 'location_pages',
  label: 'location page',
  searchFields: ['city', 'state'],
  defaultOrder: { column: 'created_at', ascending: false },
  editable: [
    'city', 'state', 'hero_heading', 'hero_subheading', 'banner_media_id',
    'description_md', 'testimonials', 'faqs', 'contact', 'map_embed_url',
    'cta_label', 'cta_url', 'publish_at',
  ],
  versionable: true,
  cacheTags: ['locations'],
  titleField: 'hero_heading',
};

export const releaseNotesCfg: CrudConfig = {
  entity: 'release_notes',
  label: 'release note',
  searchFields: ['title', 'description'],
  defaultOrder: { column: 'released_on', ascending: false },
  editable: ['version', 'module', 'badge', 'title', 'description', 'article_id', 'released_on'],
  cacheTags: ['help'],
  titleField: 'title',
};

export const featureReleaseCfg: CrudConfig = {
  entity: 'feature_releases',
  label: 'feature release',
  searchFields: ['title', 'summary'],
  defaultOrder: { column: 'created_at', ascending: false },
  editable: [
    'title', 'summary',
    'dest_help_article', 'kb_article_id',
    'dest_release_notes', 'release_note_id',
    'dest_erp_badge', 'dest_announcement', 'announcement_id',
    'dest_banner', 'banner_id', 'dest_inapp_notification',
    'publish_at',
  ],
  versionable: true,
  cacheTags: ['home', 'announcements', 'banners', 'help'],
  titleField: 'title',
};
