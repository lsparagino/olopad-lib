// Public API for @olopad/olotype

// Component + handle
export { OloTypeComponent, OloType } from './lib/olo-type/olo-type.component';

// Types
export type {
  OloDoc,
  OloDocJson,
  OloPersistedDoc,
  OloExtension,
  OloTypeHandle,
  OloImageUploader,
  OloUploadedImage,
  OloImageUploadError,
  OloSlashMenuItem,
  OloSlashMenuContext,
} from './lib/core/types';
export { OLO_DOC_SCHEMA_VERSION } from './lib/core/types';

// Schema + serialization (advanced use)
export { oloDefaultSchema, sanitizeUrl, sanitizeImageSrc } from './lib/core/schema';
export { buildSchema } from './lib/core/extensions';
export {
  emptyDoc,
  migrateDoc,
  parseDoc,
  serializeDoc,
  type OloDocMigration,
} from './lib/core/serialize';

// Default slash items (so hosts can extend / re-order them)
export { OLO_DEFAULT_SLASH_ITEMS, filterSlashItems } from './lib/ui/slash-menu/default-items';

// Toolbar / bubble menu item registry — for customization
export {
  buildMenuRegistry,
  resolveMenuItems,
  isMarkActive,
  DEFAULT_TOOLBAR_ITEMS,
  DEFAULT_BUBBLE_MENU_ITEMS,
  OLO_MENU_ITEM_IDS,
  type OloMenuItem,
  type OloMenuItemId,
} from './lib/ui/menu-items';

// Block drag handle state (for advanced use / debugging)
export type { OloBlockHandleState } from './lib/ui/block-handle/block-handle.plugin';

// Angular NodeView bridge
export {
  OLO_NODE_VIEW_CONTEXT,
  type OloNodeViewContext,
} from './lib/node-view/node-view-context';
export { OloNodeViewBridge } from './lib/node-view/angular-node-view';

// Image upload (advanced: hosts that want their own entry point)
export {
  beginUpload,
  openImagePicker,
  pendingUploadCount,
} from './lib/ui/image-upload/image-upload.plugin';
