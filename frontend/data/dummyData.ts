import { storageService } from '../services/storageService';
import { authService } from '../services/authService';
import { activityService } from '../services/activityService';

export const initDummyData = () => {
    const isInitialized = storageService.getItem('dummyDataInitialized');
    if (isInitialized) {
        return;
    }

    try {
        localStorage.clear();

        const org1 = authService.createOrganization("Zuari Sugar Mill A");
        const org2 = authService.createOrganization("Nizam Deccan Sugars Ltd");
        
        const superAdmin = authService.createUser({ name: 'Super Admin', email: 'superadmin@ganna.app', password: 'superadmin', role: 'superadmin', organizationId: 'super' });

        activityService.logActivity({ type: 'ORG_CREATE', actorId: superAdmin.id, targetId: org1.id, details: { actorName: superAdmin.name, targetName: org1.name } });
        activityService.logActivity({ type: 'ORG_CREATE', actorId: superAdmin.id, targetId: org2.id, details: { actorName: superAdmin.name, targetName: org2.name } });

        const adminZuari = authService.createUser({ name: 'Admin Zuari', email: 'admin_zuari@ganna.app', password: 'password', role: 'admin', organizationId: org1.id });
        activityService.logActivity({ type: 'USER_CREATE_ADMIN', actorId: superAdmin.id, targetId: adminZuari.id, details: { actorName: superAdmin.name, targetName: adminZuari.name, organizationName: org1.name } });
        
        const userZuari = authService.createUser({ name: 'User Zuari', email: 'user_zuari@ganna.app', password: 'password', role: 'user', organizationId: org1.id });
        const viewerZuari = authService.createUser({ name: 'Viewer Zuari', email: 'viewer_zuari@ganna.app', password: 'password', role: 'viewer', organizationId: org1.id });
        
        activityService.logActivity({ type: 'USER_CREATE_MEMBER', actorId: adminZuari.id, targetId: userZuari.id, details: { actorName: adminZuari.name, targetName: userZuari.name, organizationName: org1.name }});
        activityService.logActivity({ type: 'USER_CREATE_MEMBER', actorId: adminZuari.id, targetId: viewerZuari.id, details: { actorName: adminZuari.name, targetName: viewerZuari.name, organizationName: org1.name }});

        const adminNizam = authService.createUser({ name: 'Admin Nizam', email: 'admin_nizam@ganna.app', password: 'password', role: 'admin', organizationId: org2.id });
        activityService.logActivity({ type: 'USER_CREATE_ADMIN', actorId: superAdmin.id, targetId: adminNizam.id, details: { actorName: superAdmin.name, targetName: adminNizam.name, organizationName: org2.name } });
        
        authService.createUser({ name: 'User Nizam', email: 'user_nizam@ganna.app', password: 'password', role: 'user', organizationId: org2.id });
        authService.createUser({ name: 'Viewer Nizam', email: 'viewer_nizam@ganna.app', password: 'password', role: 'viewer', organizationId: org2.id });
        
        storageService.setItem('dummyDataInitialized', true);
        console.log('Dummy users and orgs initialized successfully. No transactional data was created.');

    } catch (e) {
        console.error('Failed to initialize dummy data:', e);
    }
};
