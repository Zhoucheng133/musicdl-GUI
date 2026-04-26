import { defineStore } from "pinia";
import { ref } from "vue";

export enum Page{
  Home,
  Settings,
}

export default defineStore("index", ()=>{
  const page=ref(Page.Home);
  const client=ref('NeteaseMusicClient');
  const keyword=ref('');

  return {
    page,
    client,
    keyword
  };
});