/**
 * Quick test: Teacher, School, and Academy Profile System
 * Run with: node src/utils/test_profile_system.js
 */

const { TeacherProfile, TeacherProfileManager } = require('../models/TeacherProfile');
const { Organization, OrganizationManager } = require('../models/Organization');
const PermissionService = require('../services/PermissionService');
global.PermissionService = PermissionService;

const AIContextEngine = require('../services/AIContextEngine');
global.AIContextEngine = AIContextEngine;

const AIChatIntegration = require('../services/AIChatIntegration');

function runTests() {
    console.log('─── Testing Profile System ───\n');

    // 1. Create Organization (Academy)
    console.log('[1. Creating Academy]');
    const myAcademy = OrganizationManager.createOrganization({
        name: "أكاديمية التفوق",
        type: "academy",
        adminId: "admin_1"
    });
    console.log('Created:', myAcademy.name, myAcademy.id);

    // 2. Create Teacher Profile (Self-selected subject)
    console.log('\n[2. Creating Teacher Profile]');
    const teacherData = {
        fullName: "أحمد محمد",
        subject: "math", // Self-selected
        phone: "01000000000",
        bio: "معلم رياضيات بخبرة 10 سنوات.",
        academicDegree: "ماجستير طرق تدريس",
        academyId: myAcademy.id
    };
    
    let teacher = TeacherProfileManager.createTeacherProfile(teacherData);
    console.log('Created Teacher:', teacher.fullName, '- Subject:', teacher.subject, `(${teacher.subjectSource})`);

    // 3. Admin Override Subject
    console.log('\n[3. Admin Overriding Subject]');
    teacher = TeacherProfileManager.changeTeacherSubject(teacher.id, 'science');
    console.log('Updated Teacher:', teacher.fullName, '- Subject:', teacher.subject, `(${teacher.subjectSource})`);

    // 4. Link Teacher to Academy
    OrganizationManager.addTeacher(myAcademy.id, teacher.id);
    console.log(`\n[4. Added ${teacher.fullName} to ${myAcademy.name}]. Total Teachers: ${OrganizationManager.getOrganization(myAcademy.id).teachers.length}`);

    // 5. Test AI Context Enrichment
    console.log('\n[5. Testing AI Context Enrichment]');
    
    // We convert the profile to a rawUser mock just like how the app would pass it
    const rawUser = {
        id: teacher.id,
        role: 'teacher',
        ...teacher.toJSON() // Contains subject, managerSubject, bio, etc.
    };

    const aiContext = AIContextEngine.getAIContext(rawUser);
    
    console.log('Resolved Subject:', aiContext.subject);
    console.log('Teacher Profile inside Context:', aiContext.teacherProfile);

    // 6. Test AI Prompt Builder (checking if identity is injected)
    console.log('\n[6. Checking Generated System Prompt]');
    const systemPrompt = AIChatIntegration.buildAISystemPrompt(aiContext, rawUser);
    console.log("--- PROMPT START ---");
    console.log(systemPrompt.substring(0, 500) + "\n... (truncated)");
    console.log("--- PROMPT END ---");

    console.log('\n─── Tests Complete ───');
}

runTests();
