<script setup lang="ts">
import { computed } from 'vue';

import {
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  TreeSelect,
} from 'ant-design-vue';

type SchemaItem = {
  component?: any;
  componentProps?: any;
  fieldName?: string;
  formItemClass?: any;
  label?: any;
  name?: string;
  rules?: any;
};

const props = defineProps<{
  model: Record<string, any>;
  schema: SchemaItem[];
}>();

const items = computed(() => props.schema || []);

function normalizeProps(componentProps: any, model: Record<string, any>) {
  if (typeof componentProps === 'function') {
    return componentProps(model);
  }
  return componentProps || {};
}
</script>

<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <template v-for="item in items" :key="item.fieldName || item.name">
    <Form.Item
      :class="item.formItemClass"
      :label="item.label"
      :name="item.fieldName || item.name"
      :rules="item.rules"
    >
      <Input
        v-if="!item.component || item.component === 'Input'"
        v-model:value="model[item.fieldName || item.name || '']"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <Input.TextArea
        v-else-if="item.component === 'Textarea'"
        v-model:value="model[item.fieldName || item.name || '']"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <Input.Password
        v-else-if="item.component === 'Password'"
        v-model:value="model[item.fieldName || item.name || '']"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <InputNumber
        v-else-if="item.component === 'InputNumber'"
        v-model:value="model[item.fieldName || item.name || '']"
        class="w-full"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <Select
        v-else-if="item.component === 'Select'"
        v-model:value="model[item.fieldName || item.name || '']"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <DatePicker
        v-else-if="item.component === 'DatePicker'"
        v-model:value="model[item.fieldName || item.name || '']"
        class="w-full"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <Switch
        v-else-if="item.component === 'Switch'"
        v-model:checked="model[item.fieldName || item.name || '']"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <Checkbox
        v-else-if="item.component === 'Checkbox'"
        v-model:checked="model[item.fieldName || item.name || '']"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <TreeSelect
        v-else-if="item.component === 'TreeSelect'"
        v-model:value="model[item.fieldName || item.name || '']"
        v-bind="normalizeProps(item.componentProps, model)"
      />
      <Input
        v-else
        v-model:value="model[item.fieldName || item.name || '']"
        v-bind="normalizeProps(item.componentProps, model)"
      />
    </Form.Item>
  </template>
</template>
