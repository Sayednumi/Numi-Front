/**
 * Quick test for Teacher Personality Layer
 */

const PermissionService = require('../services/PermissionService');
global.PermissionService = PermissionService;
const AIContextEngine = require('../services/AIContextEngine');
global.AIContextEngine = AIContextEngine;

const { buildAISystemPrompt, getTeachingStrategy } = require('../services/AIChatIntegration');

const studentUser = { role: 'student', subject: 'math', name: 'أحمد' };
const studentContext = AIContextEngine.getAIContext(studentUser);
console.log('--- STUDENT PROMPT ---');
console.log(buildAISystemPrompt(studentContext, studentUser));


const teacherUser = { role: 'teacher', subject: 'science', name: 'أ. سارة' };
const teacherContext = AIContextEngine.getAIContext(teacherUser);
console.log('\n--- TEACHER PROMPT ---');
console.log(buildAISystemPrompt(teacherContext, teacherUser));

const managerUser = { role: 'manager', subject: 'english', name: 'المدير العام' };
const managerContext = AIContextEngine.getAIContext(managerUser);
console.log('\n--- MANAGER PROMPT ---');
console.log(buildAISystemPrompt(managerContext, managerUser));
