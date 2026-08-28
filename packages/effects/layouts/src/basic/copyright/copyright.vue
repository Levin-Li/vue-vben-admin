<script lang="ts" setup>
interface Props {
  companyName?: string;
  companySiteLink?: string;
  date?: string;
  icp?: string;
  icpLink?: string;
  text?: string;
}

defineOptions({
  name: 'Copyright',
});

defineProps<Props>();
</script>

<template>
  <div v-if="text" class="text-md flex-center">
    {{ text }}
  </div>
</template>
