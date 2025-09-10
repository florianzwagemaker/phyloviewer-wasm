<template>
  <div class="legend">
    <h4>Legend</h4>
    <div 
      v-for="[value, color] in Object.entries(colorMap)" 
      :key="value" 
      class="legend-item"
    >
      <div 
        class="color-box" 
        :style="{ backgroundColor: color }"
      ></div>
      <span>{{ value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Props
interface Props {
  colorMap: Record<string, string>
}

defineProps<Props>()
</script>

<style scoped>
.legend {
  margin-top: 15px;
}

.legend h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #555;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.color-box {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  border: 1px solid #ddd;
  border-radius: 2px;
}

.legend-item span {
  font-size: 12px;
  color: #333;
}
</style>
