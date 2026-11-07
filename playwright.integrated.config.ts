import config from './playwright.teacher.config';
export default {...config,testMatch:'integrated.spec.ts',webServer:{...config.webServer!,env:{VITE_INTEGRATED_PROGRESS:'pilot-v1'}}};
