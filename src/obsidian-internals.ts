/**
 * Type declarations for internal Obsidian APIs that aren't part of the public type definitions.
 * These are used by the plugin to access features like commands and plugins.
 */

import { App, TFile, MetadataCache } from "obsidian";

/**
 * Command object returned by the commands API
 */
export interface ObsidianCommand {
	id: string;
	name: string;
}

/**
 * Commands manager interface for internal commands API
 */
export interface CommandsManager {
	listCommands(): ObsidianCommand[];
	executeCommandById(id: string): Promise<void>;
}

/**
 * Dataview plugin API interface
 */
export interface DataviewApi {
	query(
		query: string,
		originFile?: string
	): Promise<{
		successful: boolean;
		value?: {
			type: string;
			headers?: string[];
			values?: unknown[];
		};
		error?: string;
	}>;
}

/**
 * Dataview plugin interface
 */
export interface DataviewPlugin {
	api?: DataviewApi;
}

/**
 * Plugins manager interface for internal plugins API
 */
export interface PluginsManager {
	plugins: Record<string, unknown>;
}

/**
 * Extended App interface with internal APIs
 */
export interface AppWithInternals extends App {
	commands: CommandsManager;
	plugins: PluginsManager;
}

/**
 * Extended MetadataCache interface with internal backlinks API
 */
export interface MetadataCacheWithBacklinks extends MetadataCache {
	getBacklinksForFile(file: TFile): { data: Map<string, unknown>; count(): number } | null;
}

/**
 * Helper function to access the internal App APIs
 */
export function getAppInternals(app: App): AppWithInternals {
	return app as AppWithInternals;
}

/**
 * Helper function to get the Dataview API if available
 */
export function getDataviewApi(app: App): DataviewApi | null {
	const internals = getAppInternals(app);
	const dataviewPlugin = internals.plugins?.plugins?.dataview as DataviewPlugin | undefined;
	return dataviewPlugin?.api ?? null;
}

/**
 * Helper function to check if Dataview is enabled
 */
export function isDataviewEnabled(app: App): boolean {
	return getDataviewApi(app) !== null;
}

/**
 * Helper function to get the extended metadata cache
 */
export function getMetadataCacheWithBacklinks(app: App): MetadataCacheWithBacklinks {
	return app.metadataCache as MetadataCacheWithBacklinks;
}
