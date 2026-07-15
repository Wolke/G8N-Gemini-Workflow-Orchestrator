/**
 * G8N - GAS Engine
 * Handles workflow storage and tool execution
 */

const Engine = {
    /**
     * Save workflow definition to Script Properties or Drive
     */
    syncWorkflow(workflow) {
        const json = JSON.stringify(workflow);

        // GAS Properties have 9KB limit per property
        if (json.length > 9000) {
            // Fallback to Drive storage
            const filename = `g8n_workflow_${workflow.id}.json`;
            const files = DriveApp.getFilesByName(filename);

            if (files.hasNext()) {
                const file = files.next();
                file.setContent(json);
            } else {
                DriveApp.createFile(filename, json, MimeType.PLAIN_TEXT);
            }

            return { storage: 'drive', id: workflow.id };
        } else {
            PropertiesService.getScriptProperties().setProperty('CURRENT_WORKFLOW', json);
            return { storage: 'properties', id: workflow.id };
        }
    },

    /**
     * Get current workflow
     */
    getWorkflow() {
        const json = PropertiesService.getScriptProperties().getProperty('CURRENT_WORKFLOW');
        return json ? JSON.parse(json) : null;
    },

    /**
     * Execute a specific tool
     */
    executeTool(toolType, config) {
        switch (toolType) {
            case 'calendar':
            case 'gas_calendar':
                return Tools.calendar(config);
            case 'sheets':
            case 'gas_sheets':
                return Tools.sheets(config);
            case 'gmail':
            case 'gas_gmail':
                return Tools.gmail(config);
            case 'drive':
            case 'gas_drive':
                return Tools.drive(config);
            default:
                throw new Error(`Tool type not supported in GAS: ${toolType}`);
        }
    },

    /**
     * Memory Management
     */
    memory: {
        get(key) {
            const props = PropertiesService.getScriptProperties();
            const value = props.getProperty(key);
            try {
                return value ? JSON.parse(value) : null;
            } catch (e) {
                console.error('Error parsing memory key ' + key, e);
                return null;
            }
        },

        set(key, value) {
            const props = PropertiesService.getScriptProperties();
            if (value === null || value === undefined) {
                props.deleteProperty(key);
            } else {
                props.setProperty(key, JSON.stringify(value));
            }
            return true;
        }
    }
};

/**
 * Tool Implementations
 */
const Tools = {
    /**
     * Google Calendar operations
     */
    calendar(config) {
        const { action, title, startTime, endTime, description, calendarId, eventId } = config;
        const calendar = calendarId
            ? CalendarApp.getCalendarById(calendarId)
            : CalendarApp.getDefaultCalendar();

        if (!calendar) {
            throw new Error('Calendar not found');
        }

        switch (action) {
            case 'create_event':
                if (!title || !startTime || !endTime) {
                    throw new Error('Missing required fields: title, startTime, endTime');
                }
                const newEvent = calendar.createEvent(
                    title,
                    new Date(startTime),
                    new Date(endTime),
                    { description: description || '' }
                );
                return {
                    success: true,
                    eventId: newEvent.getId(),
                    title: newEvent.getTitle(),
                    startTime: newEvent.getStartTime().toISOString(),
                    endTime: newEvent.getEndTime().toISOString()
                };

            case 'list_events':
                const now = new Date();
                const future = new Date(now.getTime() + (config.daysAhead || 7) * 86400000);
                const events = calendar.getEvents(now, future);
                return events.map(e => ({
                    id: e.getId(),
                    title: e.getTitle(),
                    startTime: e.getStartTime().toISOString(),
                    endTime: e.getEndTime().toISOString(),
                    description: e.getDescription()
                }));

            case 'delete_event':
                if (!eventId) {
                    throw new Error('Missing eventId');
                }
                const eventToDelete = calendar.getEventById(eventId);
                if (eventToDelete) {
                    eventToDelete.deleteEvent();
                    return { success: true, message: 'Event deleted' };
                }
                throw new Error('Event not found');

            case 'update_event':
                if (!eventId) {
                    throw new Error('Missing eventId');
                }
                const eventToUpdate = calendar.getEventById(eventId);
                if (!eventToUpdate) {
                    throw new Error('Event not found');
                }
                if (title) eventToUpdate.setTitle(title);
                if (description) eventToUpdate.setDescription(description);
                if (startTime && endTime) {
                    eventToUpdate.setTime(new Date(startTime), new Date(endTime));
                }
                return {
                    success: true,
                    eventId: eventToUpdate.getId(),
                    title: eventToUpdate.getTitle()
                };

            default:
                // Default: list upcoming events
                const defaultEvents = calendar.getEvents(new Date(), new Date(Date.now() + 7 * 86400000));
                return defaultEvents.map(e => ({
                    id: e.getId(),
                    title: e.getTitle(),
                    startTime: e.getStartTime().toISOString(),
                    endTime: e.getEndTime().toISOString()
                }));
        }
    },

    /**
     * Google Sheets operations (placeholder for future)
     */
    sheets(config) {
        const { spreadsheetId, sheetName, action, range, values } = config;

        if (!spreadsheetId) {
            throw new Error('Missing spreadsheetId');
        }

        const ss = SpreadsheetApp.openById(spreadsheetId);
        const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];

        if (!sheet) {
            throw new Error(`Sheet ${sheetName} not found`);
        }

        switch (action) {
            case 'read':
                const dataRange = range ? sheet.getRange(range) : sheet.getDataRange();
                return dataRange.getValues();

            case 'append':
                if (!values) throw new Error('Missing values');
                sheet.appendRow(Array.isArray(values) ? values : [values]);
                return { success: true, message: 'Row appended' };

            case 'write':
                if (!range || !values) throw new Error('Missing range or values');
                sheet.getRange(range).setValues(values);
                return { success: true, message: 'Data written' };

            default:
                return sheet.getDataRange().getValues();
        }
    },

    /**
     * Gmail operations (placeholder for future)
     */
    gmail(config) {
        const { to, subject, body, action } = config;

        switch (action) {
            case 'send':
                if (!to || !subject || !body) {
                    throw new Error('Missing required fields: to, subject, body');
                }
                GmailApp.sendEmail(to, subject, body);
                return { success: true, message: 'Email sent' };

            case 'list_drafts':
                const drafts = GmailApp.getDrafts();
                return drafts.slice(0, 10).map(d => ({
                    id: d.getId(),
                    subject: d.getMessage().getSubject()
                }));

            default:
                throw new Error('Invalid Gmail action');
        }
    },

    /**
     * Google Drive operations (placeholder for future)
     */
    drive(config) {
        const { action, query, fileName, content, folderId } = config;

        switch (action) {
            case 'search':
                const files = DriveApp.searchFiles(query || 'trashed = false');
                const results = [];
                while (files.hasNext() && results.length < 10) {
                    const f = files.next();
                    results.push({
                        name: f.getName(),
                        id: f.getId(),
                        url: f.getUrl(),
                        mimeType: f.getMimeType()
                    });
                }
                return results;

            case 'create':
                if (!fileName || !content) {
                    throw new Error('Missing fileName or content');
                }
                const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
                const file = folder.createFile(fileName, content);
                return {
                    id: file.getId(),
                    url: file.getUrl(),
                    name: file.getName()
                };

            default:
                throw new Error('Invalid Drive action');
        }
    }
};
