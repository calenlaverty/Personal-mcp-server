import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HevyClient } from '../hevy/client.js';
import { handleToolError } from '../utils/errors.js';
import { CreateFolderInputSchema, safeValidateInput } from '../utils/validators.js';
import { RoutineFolder } from '../hevy/types.js';

// Export folder tool definitions
export function getFolderTools() {
  return [
    {
      name: 'get-routine-folders',
      description: 'Get a list of all routine folders. Use folders to organize your workout routines.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get-routine-folder',
      description: 'Get detailed information about a specific routine folder by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique folder ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'create-routine-folder',
      description: 'Create a new folder to organize workout routines.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Folder name (e.g., "Strength Training", "Cardio Routines")',
          },
        },
        required: ['title'],
      },
    },
    {
      name: 'update-routine-folder',
      description: 'Update an existing routine folder name.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique folder ID to update',
          },
          title: {
            type: 'string',
            description: 'New folder name',
          },
        },
        required: ['id', 'title'],
      },
    },
    {
      name: 'delete-routine-folder',
      description: 'Delete a routine folder by ID. This action cannot be undone.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique folder ID to delete',
          },
        },
        required: ['id'],
      },
    },
  ];
}

// Handle folder tool calls
export async function handleFolderToolCall(request: any, client: HevyClient) {
  try {
    switch (request.params.name) {
        case 'get-routine-folders': {
          const folders = await client.getRoutineFolders();

          if (folders.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No routine folders found.',
                },
              ],
            };
          }

          const lines: string[] = [`Found ${folders.length} folder(s):\n`];
          folders.forEach((folder: RoutineFolder, idx: number) => {
            lines.push(`${idx + 1}. **${folder.title}**`);
            lines.push(`   ID: ${folder.id}`);
            if (folder.created_at) {
              lines.push(`   Created: ${new Date(folder.created_at).toLocaleDateString()}`);
            }
            lines.push('');
          });

          return {
            content: [
              {
                type: 'text',
                text: lines.join('\n'),
              },
            ],
          };
        }

        case 'get-routine-folder': {
          const { id } = request.params.arguments as { id: string };
          if (!id) {
            return {
              content: [{ type: 'text', text: 'Error: folder ID is required' }],
              isError: true,
            };
          }

          const folder = await client.getRoutineFolder(id);
          const lines: string[] = [];
          lines.push(`# ${folder.title}`);
          lines.push(`**ID:** ${folder.id}`);
          if (folder.created_at) {
            lines.push(`**Created:** ${new Date(folder.created_at).toLocaleString()}`);
          }
          if (folder.updated_at) {
            lines.push(`**Updated:** ${new Date(folder.updated_at).toLocaleString()}`);
          }

          return {
            content: [
              {
                type: 'text',
                text: lines.join('\n'),
              },
            ],
          };
        }

        case 'create-routine-folder': {
          const validation = safeValidateInput(
            CreateFolderInputSchema,
            request.params.arguments || {}
          );

          if (!validation.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Validation error: ${validation.error.message}`,
                },
              ],
              isError: true,
            };
          }

          const folder = await client.createRoutineFolder(validation.data);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Folder created successfully!\n\n**${folder.title}**\nID: ${folder.id}`,
              },
            ],
          };
        }

        case 'update-routine-folder': {
          const { id, title } = request.params.arguments as { id: string; title: string };
          if (!id) {
            return {
              content: [{ type: 'text', text: 'Error: folder ID is required' }],
              isError: true,
            };
          }

          const validation = safeValidateInput(CreateFolderInputSchema, { title });

          if (!validation.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Validation error: ${validation.error.message}`,
                },
              ],
              isError: true,
            };
          }

          const folder = await client.updateRoutineFolder(id, validation.data);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Folder updated successfully!\n\n**${folder.title}**\nID: ${folder.id}`,
              },
            ],
          };
        }

        case 'delete-routine-folder': {
          const { id } = request.params.arguments as { id: string };
          if (!id) {
            return {
              content: [{ type: 'text', text: 'Error: folder ID is required' }],
              isError: true,
            };
          }

          await client.deleteRoutineFolder(id);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Folder deleted successfully! (ID: ${id})`,
              },
            ],
          };
        }

        default:
          return null; // Tool not handled by this module
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: handleToolError(error),
          },
        ],
        isError: true,
      };
    }
}
