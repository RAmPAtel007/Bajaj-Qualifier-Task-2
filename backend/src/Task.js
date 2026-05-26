import mongoose from 'mongoose';

const { Schema } = mongoose;

const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: [3, 'title must be at least 3 characters'],
      maxlength: [100, 'title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'description cannot exceed 500 characters'],
    },
    importance: {
      type: Number,
      required: [true, 'importance is required'],
      min: [1, 'importance must be between 1 and 5'],
      max: [5, 'importance must be between 1 and 5'],
      validate: {
        validator: Number.isInteger,
        message: 'importance must be an integer',
      },
    },
    dueDate: {
      type: Date,
      required: [true, 'dueDate is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'completed'],
        message: "status must be 'pending' or 'completed'",
      },
      default: 'pending',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Task = mongoose.model('Task', taskSchema);
