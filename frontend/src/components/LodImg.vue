<template>
  <img
    v-if="src"
    :src="displaySrc"
    :alt="alt"
    :class="imgClass"
    :style="imgStyle"
    loading="lazy"
    @load="onLoad"
    @error="onError"
  />
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  src: { type: String, default: '' },
  thumb: { type: String, default: '' },
  alt: { type: String, default: '' },
  imgClass: { type: String, default: '' },
  imgStyle: { type: [String, Object], default: undefined },
});

const displaySrc = ref(props.thumb || props.src);

function loadFull() {
  if (!props.src || props.src === displaySrc.value) return;
  const img = new Image();
  img.onload = () => { displaySrc.value = props.src; };
  img.src = props.src;
}

function onLoad() {
  if (props.thumb && props.src && displaySrc.value === props.thumb) loadFull();
}

function onError() {
  if (props.src && displaySrc.value !== props.src) {
    displaySrc.value = props.src;
  }
}

watch(
  () => [props.src, props.thumb],
  () => {
    displaySrc.value = props.thumb || props.src;
    if (props.thumb && props.src) loadFull();
  },
  { immediate: false }
);
</script>
