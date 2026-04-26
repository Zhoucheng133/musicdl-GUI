import { defineStore } from "pinia";
import { ref } from "vue";
import { message } from '@tauri-apps/plugin-dialog';

export enum Page{
  Home,
  Settings,
}

export default defineStore("index", ()=>{
  const page=ref(Page.Home);
  const client=ref('NeteaseMusicClient');
  const keyword=ref('');
  const search=async ()=>{
    if(keyword.value.length === 0){
      message('搜索关键词不能为空', { title: '无法搜索', kind: 'error' });
    }
  };

  return {
    page,
    client,
    keyword,
    search
  };
});