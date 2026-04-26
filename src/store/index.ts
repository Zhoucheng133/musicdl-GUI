import { defineStore } from "pinia";
import { ref } from "vue";
import { message } from '@tauri-apps/plugin-dialog';
import { Command } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { downloadDir, extname, homeDir, join } from "@tauri-apps/api/path";
import { download as fetchFile } from '@tauri-apps/plugin-upload';

export class ListItem{
  constructor(
    public name: string, 
    public artist: string,
    public album: string,
    public url: string,
    public cover: string,
    public duration: string,
  ){}
}

export default defineStore("index", ()=>{
  const client=ref('NeteaseMusicClient');
  const keyword=ref('');
  const loading=ref(false);

  const downloading = ref(false);
  const converting = ref(false);
  const downloadProgress = ref(0);
  const downloadPath=ref('');
  const list=ref<ListItem[]>([]);
  const encode=ref("mp3 (320k)");
  const saveConfig=ref(false);
  const showProgressDialog=ref(false);

  const search=async ()=>{
    if(keyword.value.length === 0){
      await message('搜索关键词不能为空', { title: '无法搜索', kind: 'error' });
      return;
    }
    loading.value=true;
    const home = await homeDir();
    const args=[
      "-keyword", keyword.value,
      "-client", client.value,
      "-workdir", home,
    ]

    const command = Command.sidecar('binaries/core', args, {
      encoding: "utf-8",
      env: {
        "PYTHONUTF8": "1",
        "LANG": "en_US.UTF-8",
        "LC_ALL": "en_US.UTF-8"
      }
    });
    const output = await command.execute();
    const match = output.stdout.match(/===JSON_START===\n([\s\S]*)\n===JSON_END===/);
    if(match){
      const jsonData = JSON.parse(match[1]);
      console.log(jsonData);
      list.value=jsonData.map((item: any)=>{
        const formattedTime = item.duration.replace(/^00:/, '');
        return new ListItem(
          item.name,
          item.artist,
          item.album,
          item.url,
          item.cover,
          formattedTime,
        );
      });
    }
    loading.value=false;
  };

  const pathCheck=async (path: string): Promise<boolean> =>{
    return await invoke('path_check', { path });
  }

  const download=async (item: ListItem)=>{
    downloadProgress.value=0;
    downloading.value=true;
    showProgressDialog.value=true;
    
    const cleanUrl = item.url.split('?')[0];
    const ext=await extname(cleanUrl);
    let path=await join(downloadPath.value, `${item.artist} - ${item.name}.${ext}`);

    try {
      await fetchFile(item.url, path, ({progressTotal, total})=>{
        downloadProgress.value=progressTotal/total;
      })
      downloading.value=false;
      convert(item);
    } catch (_) {
      downloading.value=false;
    }
  }

  const convert=(item: ListItem)=>{
    showProgressDialog.value=false;
  }

  const init=async ()=>{
    downloadPath.value=await downloadDir();
  }

  return {
    client,
    keyword,
    search,
    list,
    loading,
    download,
    downloadPath,
    encode,
    saveConfig,
    pathCheck,
    downloading,
    downloadProgress,
    converting,
    init,
    showProgressDialog
  };
});