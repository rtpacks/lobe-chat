import { LobeChatPluginManifest } from '@lobehub/chat-plugin-sdk';
import { uniqBy } from 'lodash-es';
import { Md5 } from 'ts-md5';

import { PLUGIN_SCHEMA_API_MD5_PREFIX, PLUGIN_SCHEMA_SEPARATOR } from '@/const/plugin';
import { pluginHelpers } from '@/store/tool';
import { ToolStoreState } from '@/store/tool/initialState';
import { pluginSelectors } from '@/store/tool/slices/plugin/selectors';
import { ChatCompletionFunctions } from '@/types/openai/chat';

const enabledSchema =
  (tools: string[] = []) =>
  (s: ToolStoreState): ChatCompletionFunctions[] => {
    const list = pluginSelectors
      .installedPluginManifestList(s)
      .concat(s.builtinTools.map((b) => b.manifest as LobeChatPluginManifest))
      // 如果存在 enabledPlugins，那么只启用 enabledPlugins 中的插件
      .filter((m) => tools.includes(m?.identifier))
      .flatMap((manifest) =>
        manifest.api.map((m) => {
          const pluginType =
            manifest.type && manifest.type !== 'default'
              ? `${PLUGIN_SCHEMA_SEPARATOR + manifest.type}`
              : '';

          // 将插件的 identifier 作为前缀，避免重复
          let apiName = manifest.identifier + PLUGIN_SCHEMA_SEPARATOR + m.name + pluginType;

          // OpenAI GPT function_call name can't be longer than 64 characters
          // So we need to use md5 to shorten the name
          // and then find the correct apiName in response by md5
          if (apiName.length >= 64) {
            const md5Content = PLUGIN_SCHEMA_API_MD5_PREFIX + Md5.hashStr(m.name).toString();

            apiName = manifest.identifier + PLUGIN_SCHEMA_SEPARATOR + md5Content + pluginType;
          }

          return {
            ...m,
            name: apiName,
          };
        }),
      );

    return uniqBy(list, 'name');
  };

const enabledSystemRoles =
  (tools: string[] = []) =>
  (s: ToolStoreState) => {
    const toolsSystemRole = pluginSelectors
      .installedPluginManifestList(s)
      .concat(s.builtinTools.map((b) => b.manifest as LobeChatPluginManifest))
      // 如果存在 enabledPlugins，那么只启用 enabledPlugins 中的插件
      .filter((m) => tools.includes(m?.identifier))
      .map((manifest) => {
        if (!manifest) return '';

        const meta = manifest.meta || {};

        const title = pluginHelpers.getPluginTitle(meta) || manifest.identifier;
        const systemRole = manifest.systemRole || pluginHelpers.getPluginDesc(meta);

        return [`### ${title}`, systemRole].join('\n\n');
      })
      .filter(Boolean);

    if (toolsSystemRole.length > 0) {
      return ['## Tools', 'You can use these tools below:', ...toolsSystemRole]
        .filter(Boolean)
        .join('\n\n');
    }

    return '';
  };

export const toolSelectors = {
  enabledSchema,
  enabledSystemRoles,
};
