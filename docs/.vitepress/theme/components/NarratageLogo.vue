<script setup lang="ts">
import { withBase } from "vitepress";

withDefaults(defineProps<{ label?: string }>(), { label: "Qflow" });
</script>

<template>
  <span class="qflow-logo">
    <img class="qflow-logo-on-light" :src="withBase('/qflow-logo-dark.png')" :alt="label" />
    <img class="qflow-logo-on-dark" :src="withBase('/qflow-logo-light.png')" :alt="label" />
  </span>
</template>
