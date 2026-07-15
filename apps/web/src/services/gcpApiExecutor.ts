// GCP API Executor - Executes GCP API calls using OAuth token

import { GcpAuthService } from './gcpAuthService';
import { useWorkflowStore } from '../stores/workflowStore';
import type { GcpApiTool } from '../types/nodes';

// Function declarations for Gemini function calling
export const GCP_FUNCTION_DECLARATIONS: Record<GcpApiTool, any> = {
    youtube_data: {
        name: 'search_youtube_videos',
        description: 'Search for videos on YouTube. Used to find videos of specific topics, channels, or content types.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query',
                },
                maxResults: {
                    type: 'number',
                    description: 'Max results (1-50)',
                },
            },
            required: ['query'],
        },
    },
    google_calendar: {
        name: 'list_calendar_events',
        description: 'List events in Google Calendar. Used to view upcoming schedule or events on specific dates.',
        parameters: {
            type: 'object',
            properties: {
                timeMin: {
                    type: 'string',
                    description: 'Start time (ISO 8601 format, e.g., 2024-01-01T00:00:00Z)',
                },
                timeMax: {
                    type: 'string',
                    description: 'End time (ISO 8601 format)',
                },
                maxResults: {
                    type: 'number',
                    description: 'Max results',
                },
            },
            required: [],
        },
    },
    gmail: {
        name: 'search_gmail',
        description: 'Search Gmail messages. Used to find emails from specific senders, with specific subjects or content.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query (supports Gmail search syntax, e.g., from:xxx subject:xxx)',
                },
                maxResults: {
                    type: 'number',
                    description: 'Max results',
                },
            },
            required: ['query'],
        },
    },
    google_drive: {
        name: 'list_drive_files',
        description: 'List files and folders in Google Drive. Used to browse cloud storage content.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query (supports Drive query syntax)',
                },
                maxResults: {
                    type: 'number',
                    description: 'Max results',
                },
            },
            required: [],
        },
    },
    places_api: {
        name: 'search_places',
        description: 'Search for place information. Used to find restaurants, stores, attractions, etc.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search place query',
                },
                location: {
                    type: 'string',
                    description: 'Location coordinates (format: lat,lng)',
                },
                radius: {
                    type: 'number',
                    description: 'Search radius (meters)',
                },
            },
            required: ['query'],
        },
    },
};

// API Base URLs
const API_BASE = {
    youtube: 'https://www.googleapis.com/youtube/v3',
    calendar: 'https://www.googleapis.com/calendar/v3',
    gmail: 'https://www.googleapis.com/gmail/v1',
    drive: 'https://www.googleapis.com/drive/v3',
    places: 'https://maps.googleapis.com/maps/api/place',
};

/**
 * Execute a GCP API function call
 */
export async function executeGcpFunction(
    functionName: string,
    args: Record<string, any>
): Promise<any> {
    const token = GcpAuthService.getAccessToken();
    if (!token) {
        return { error: true, message: 'Unauthorized. Please login to Google first.' };
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (functionName) {
            case 'search_youtube_videos': {
                const url = new URL(`${API_BASE.youtube}/search`);
                url.searchParams.set('part', 'snippet');
                url.searchParams.set('type', 'video');
                url.searchParams.set('q', args.query);
                url.searchParams.set('maxResults', String(args.maxResults || 10));

                const res = await fetch(url.toString(), { headers });
                const data = await res.json();

                if (data.error) {
                    return { error: true, message: data.error.message };
                }

                return {
                    success: true,
                    videos: data.items?.map((item: any) => ({
                        title: item.snippet.title,
                        description: item.snippet.description,
                        videoId: item.id.videoId,
                        channelTitle: item.snippet.channelTitle,
                        publishedAt: item.snippet.publishedAt,
                        thumbnail: item.snippet.thumbnails?.default?.url,
                    })) || [],
                };
            }

            case 'list_calendar_events': {
                const url = new URL(`${API_BASE.calendar}/calendars/primary/events`);
                if (args.timeMin) url.searchParams.set('timeMin', args.timeMin);
                if (args.timeMax) url.searchParams.set('timeMax', args.timeMax);
                url.searchParams.set('maxResults', String(args.maxResults || 10));
                url.searchParams.set('singleEvents', 'true');
                url.searchParams.set('orderBy', 'startTime');

                const res = await fetch(url.toString(), { headers });
                const data = await res.json();

                if (data.error) {
                    return { error: true, message: data.error.message };
                }

                return {
                    success: true,
                    events: data.items?.map((item: any) => ({
                        summary: item.summary,
                        start: item.start?.dateTime || item.start?.date,
                        end: item.end?.dateTime || item.end?.date,
                        location: item.location,
                        description: item.description,
                    })) || [],
                };
            }

            case 'search_gmail': {
                const url = new URL(`${API_BASE.gmail}/users/me/messages`);
                url.searchParams.set('q', args.query);
                url.searchParams.set('maxResults', String(args.maxResults || 10));

                const res = await fetch(url.toString(), { headers });
                const data = await res.json();

                if (data.error) {
                    return { error: true, message: data.error.message };
                }

                // Fetch message details
                const messages = await Promise.all(
                    (data.messages || []).slice(0, 5).map(async (msg: any) => {
                        const msgRes = await fetch(
                            `${API_BASE.gmail}/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
                            { headers }
                        );
                        const msgData = await msgRes.json();
                        const getHeader = (name: string) =>
                            msgData.payload?.headers?.find((h: any) => h.name === name)?.value || '';
                        return {
                            id: msg.id,
                            subject: getHeader('Subject'),
                            from: getHeader('From'),
                            date: getHeader('Date'),
                            snippet: msgData.snippet,
                        };
                    })
                );

                return { success: true, messages };
            }

            case 'list_drive_files': {
                const url = new URL(`${API_BASE.drive}/files`);
                url.searchParams.set('pageSize', String(args.maxResults || 20));
                url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,size)');
                if (args.query) {
                    url.searchParams.set('q', args.query);
                }

                const res = await fetch(url.toString(), { headers });
                const data = await res.json();

                if (data.error) {
                    return { error: true, message: data.error.message };
                }

                return {
                    success: true,
                    files: data.files?.map((file: any) => ({
                        name: file.name,
                        id: file.id,
                        type: file.mimeType,
                        modifiedTime: file.modifiedTime,
                        size: file.size,
                    })) || [],
                };
            }

            case 'search_places': {
                // Places API uses API Key, not OAuth
                const { settings } = useWorkflowStore.getState();
                const apiKey = settings.gcpApiKey;

                if (!apiKey) {
                    return {
                        error: true,
                        message: 'Please set Places API Key in Settings first.',
                    };
                }

                // Use Places API (New) - Text Search
                const url = new URL('https://places.googleapis.com/v1/places:searchText');

                const res = await fetch(url.toString(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.googleMapsUri',
                    },
                    body: JSON.stringify({
                        textQuery: args.query,
                        maxResultCount: args.maxResults || 10,
                        ...(args.location && {
                            locationBias: {
                                circle: {
                                    center: {
                                        latitude: parseFloat(args.location.split(',')[0]),
                                        longitude: parseFloat(args.location.split(',')[1]),
                                    },
                                    radius: args.radius || 5000,
                                },
                            },
                        }),
                    }),
                });

                const data = await res.json();

                if (data.error) {
                    return { error: true, message: data.error.message };
                }

                return {
                    success: true,
                    places: data.places?.map((place: any) => ({
                        name: place.displayName?.text,
                        address: place.formattedAddress,
                        rating: place.rating,
                        ratingCount: place.userRatingCount,
                        types: place.types,
                        mapsUrl: place.googleMapsUri,
                    })) || [],
                };
            }

            default:
                return { error: true, message: `Unknown function: ${functionName}` };
        }
    } catch (e: any) {
        return { error: true, message: e.message };
    }
}

/**
 * Get function declarations for connected GCP tools
 */
export function getGcpFunctionDeclarations(toolTypes: GcpApiTool[]): any[] {
    return toolTypes
        .filter(t => GCP_FUNCTION_DECLARATIONS[t])
        .map(t => GCP_FUNCTION_DECLARATIONS[t]);
}
