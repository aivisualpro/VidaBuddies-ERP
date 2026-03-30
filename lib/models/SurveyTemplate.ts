import mongoose, { Schema, Model, Document } from 'mongoose';

export interface ISurveyField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'radio' | 'checklist';
  options?: string[]; // For radio: ['Yes','No','N/A']
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helpText?: string;
  gridCols?: number; // 1 or 2 (half width)
}

export interface ISurveySection {
  title: string;
  subtitle?: string;
  description?: string;
  highlight?: boolean; // For special styling like auth section
  fields: ISurveyField[];
}

export interface ISurveyPage {
  title: string;
  icon: string; // icon name
  sections: ISurveySection[];
}

export interface ISurveyTemplate extends Document {
  templateId: string;
  name: string;
  docNo: string;
  revNo: string;
  status: 'active' | 'draft';
  description: string;
  pages: ISurveyPage[];
}

const SurveyFieldSchema = new Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'textarea', 'date', 'radio', 'checklist'], required: true },
  options: { type: [String], default: [] },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  helpText: { type: String, default: '' },
  gridCols: { type: Number, default: 1 },
}, { _id: false });

const SurveySectionSchema = new Schema({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  description: { type: String, default: '' },
  highlight: { type: Boolean, default: false },
  fields: { type: [SurveyFieldSchema], default: [] },
}, { _id: false });

const SurveyPageSchema = new Schema({
  title: { type: String, required: true },
  icon: { type: String, default: 'FileText' },
  sections: { type: [SurveySectionSchema], default: [] },
}, { _id: false });

const SurveyTemplateSchema = new Schema({
  templateId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  docNo: { type: String, default: '' },
  revNo: { type: String, default: '' },
  status: { type: String, enum: ['active', 'draft'], default: 'active' },
  description: { type: String, default: '' },
  pages: { type: [SurveyPageSchema], default: [] },
}, { timestamps: true });

const SurveyTemplate: Model<ISurveyTemplate> = mongoose.models.SurveyTemplate || mongoose.model<ISurveyTemplate>('SurveyTemplate', SurveyTemplateSchema);
export default SurveyTemplate;
