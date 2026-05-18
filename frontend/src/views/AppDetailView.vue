<template>
  <div class="app-detail-view">
    <div v-if="isLoading" class="loading-state">加载中...</div>
    <div v-else-if="!currentApp" class="empty-state">
      <p>小程序未找到</p>
      <button class="btn-back" @click="goBack">← 返回</button>
    </div>
    <component v-else :is="AppComponent" :app="currentApp" />
  </div>
</template>

<script setup lang="ts">
import { shallowRef, ref, onMounted, defineAsyncComponent, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getApp, type MiniApp } from '@/api/mini-apps'
import GenericMiniApp from '@/components/apps/GenericMiniApp.vue'

const route = useRoute()
const router = useRouter()
const currentApp = shallowRef<MiniApp | null>(null)
const AppComponent = shallowRef<Component>(GenericMiniApp as Component)
const isLoading = ref(true)

onMounted(async () => {
  try {
    const appId = route.params.appId as string
    currentApp.value = await getApp(appId)

    if (currentApp.value?.component) {
      const componentName = currentApp.value.component
      try {
        const asyncComponent = defineAsyncComponent(() =>
          import(`@/views/${appId}/${componentName}.vue`)
        )
        AppComponent.value = asyncComponent
      } catch {
        console.warn(`Custom component ${componentName} not found for ${appId}, using GenericMiniApp`)
      }
    }
  } catch (error) {
    console.error('Failed to load app:', error)
  } finally {
    isLoading.value = false
  }
})

function goBack() {
  router.push('/apps')
}
</script>

<style scoped>
.app-detail-view {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-secondary, #666);
}
</style>
