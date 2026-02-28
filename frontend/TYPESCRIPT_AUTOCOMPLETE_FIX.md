# TypeScript Autocomplete Fix for .stories.tsx Files

## Problem Summary

TypeScript autocomplete/intellisense was not working in `.stories.tsx` files in VSCode. This was caused by the Storybook-specific `tsconfig.json` not being properly configured to include all necessary source files.

## Root Cause

The `.storybook/tsconfig.json` file was originally configured to only include:
- Storybook configuration files (`**/*.ts`, `**/*.tsx`)
- Story files (`../src/**/*.stories.tsx`, `../src/**/*.stories.ts`)

However, it was **missing** all the regular component files (`../src/**/*.tsx`, `../src/**/*.ts`), which meant:
1. When you opened a `.stories.tsx` file, TypeScript couldn't resolve imports to your components
2. No autocomplete for component props
3. No type checking for component usage in stories
4. No intellisense for imported types and interfaces

## What Was Changed

### 1. Updated `.storybook/tsconfig.json`
**Location:** `/home/capic/developements/dashboard-parapente/frontend/.storybook/tsconfig.json`

**Key changes:**
- Changed `include` to `["./**/*", "../src/**/*"]` to include ALL files in both `.storybook` and `src` directories
- Added `"vite/client"` to types array for proper Vite type definitions
- Added comprehensive `exclude` array to avoid unnecessary files

### 2. Created `.vscode/settings.json`
**Location:** `/home/capic/developements/dashboard-parapente/frontend/.vscode/settings.json`

**Purpose:**
- Configures VSCode to use the workspace TypeScript version (from node_modules)
- Ensures proper file associations for `.stories.tsx` files
- Enables auto-import suggestions from package.json
- Sets up code formatting preferences

### 3. Created `.vscode/extensions.json`
**Location:** `/home/capic/developements/dashboard-parapente/frontend/.vscode/extensions.json`

**Purpose:**
- Recommends essential extensions for the best development experience:
  - ESLint for linting
  - Prettier for code formatting
  - Tailwind CSS IntelliSense for Tailwind autocomplete

## How to Verify It's Working

### Step 1: Restart VSCode TypeScript Server
1. Open any `.stories.tsx` file (e.g., `src/components/SiteSelector.stories.tsx`)
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "TypeScript: Restart TS Server" and press Enter
4. Wait a few seconds for the TypeScript server to restart

### Step 2: Check Autocomplete
1. In a `.stories.tsx` file, start typing a component import:
   ```typescript
   import { Site
   ```
   - You should see autocomplete suggestions for `SiteSelector` and other components

2. In the story args, type a prop name:
   ```typescript
   args: {
     onSelect  // Should autocomplete to onSelectSite
   ```

3. Hover over a component name or prop - you should see type information

### Step 3: Verify Type Checking
1. Try adding an invalid prop to a component in a story:
   ```typescript
   args: {
     invalidProp: 'test'  // Should show red underline
   ```
   - You should see a TypeScript error

2. Look at the bottom status bar in VSCode:
   - It should show "TypeScript" and a version number
   - Click it to see if there are any errors

### Step 4: Test Go-to-Definition
1. In a `.stories.tsx` file, `Cmd+Click` (Mac) or `Ctrl+Click` (Windows/Linux) on a component name
2. It should jump to the component's definition file

## Expected Behavior After Fix

✅ **Full autocomplete** for all imports in `.stories.tsx` files  
✅ **Type checking** for component props in story args  
✅ **Intellisense** for all TypeScript types and interfaces  
✅ **Go-to-definition** works for components and types  
✅ **Error highlighting** for type mismatches  
✅ **Auto-import suggestions** when typing component names  

## Troubleshooting

### If autocomplete still doesn't work:

1. **Check TypeScript version:**
   ```bash
   npx tsc --version
   ```
   Should show TypeScript 5.9.3 or similar

2. **Verify workspace TypeScript is being used:**
   - Look at the bottom-right corner of VSCode
   - Should show "TypeScript 5.9.3" (workspace version)
   - If it shows a different version, click it and select "Use Workspace Version"

3. **Check for TypeScript errors:**
   ```bash
   npx tsc --noEmit --project .storybook/tsconfig.json
   ```
   - This should compile without project reference errors
   - Any errors shown are existing code issues, not configuration issues

4. **Reload VSCode:**
   - Press `Cmd+Shift+P` / `Ctrl+Shift+P`
   - Type "Developer: Reload Window" and press Enter

5. **Check VSCode extensions:**
   - Make sure you have the built-in TypeScript extension enabled
   - No conflicting TypeScript extensions installed

### If you see "Cannot find module" errors:

1. Make sure `node_modules` is up to date:
   ```bash
   npm install
   ```

2. Check that Storybook types are installed:
   ```bash
   npm list @storybook/react-vite
   ```

## Technical Details

### TypeScript Configuration Hierarchy

```
tsconfig.json (root)
├── src/**/* (all source files)
└── references
    └── tsconfig.node.json (Vite config)

.storybook/tsconfig.json
├── extends: ../tsconfig.json
└── includes:
    ├── ./**/* (all Storybook config files)
    └── ../src/**/* (all source files including stories)
```

### Why This Works

When you open a `.stories.tsx` file in VSCode:

1. VSCode's TypeScript language server looks for the nearest `tsconfig.json`
2. It finds `.storybook/tsconfig.json` (because the file matches the include pattern)
3. The config extends the root `tsconfig.json` for base settings
4. The include array `["../src/**/*"]` tells TypeScript to include ALL source files
5. This allows TypeScript to resolve all imports and provide full intellisense

### Important Notes

- The main `tsconfig.json` still only includes `["src"]` for the main build
- The `.storybook/tsconfig.json` is specifically for the TypeScript language server when editing stories
- Both configs use `"noEmit": true` because Vite handles the actual bundling
- No project references are needed because we're not building composite projects

## Additional Recommendations

### VSCode Extensions to Install

If you haven't already, install these recommended extensions for the best experience:

1. **ESLint** (`dbaeumer.vscode-eslint`)
   - Provides real-time linting feedback

2. **Prettier** (`esbenp.prettier-vscode`)
   - Auto-formats code on save

3. **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
   - Autocomplete for Tailwind classes

VSCode should automatically prompt you to install these when you open the workspace.

### Keyboard Shortcuts

- `F12` or `Cmd/Ctrl+Click`: Go to definition
- `Shift+F12`: Find all references
- `F2`: Rename symbol (refactor across all files)
- `Cmd/Ctrl+Space`: Trigger autocomplete manually
- `Cmd/Ctrl+Shift+Space`: Show parameter hints

## Summary

The fix ensures that when working with `.stories.tsx` files, the TypeScript language server has access to all the necessary type information from your entire codebase, providing full autocomplete, type checking, and intellisense support.

The changes are minimal and follow TypeScript best practices for monorepo-style projects with multiple configuration files.
