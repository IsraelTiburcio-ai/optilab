export function assertProtectedEnvironment(data){
 const rule=data?.protection_rules?.find(r=>r.type==='required_reviewers');
 if(!rule||rule.prevent_self_review!==true||!Array.isArray(rule.reviewers)||rule.reviewers.length<2)throw Error('Two designated reviewers and prevention of self-review required');
 const reviewers=new Set(rule.reviewers.map(r=>r.reviewer?.login??r.reviewer?.slug).filter(Boolean));
 if(reviewers.size<2)throw Error('Distinct named reviewers required');
 if(data.can_admins_bypass!==false)throw Error('Administrator bypass must be disabled');
 return true;
}
