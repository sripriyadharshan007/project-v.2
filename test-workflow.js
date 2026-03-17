const http = require('http');

async function request(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Some backend endpoints might return empty strings on SUCCESS, try parsing only if not empty
          if(data) {
             resolve(JSON.parse(data));
          } else {
             resolve({});
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

(async () => {
    try {
        console.log('1. Creating workflow...');
        const workflow = await request('/workflow', 'POST', {
            name: 'Expense Approval',
            isActive: true,
            inputSchema: {
                amount: {type: 'number', required: true},
                country: {type: 'string', required: true},
                priority: {type: 'string', required: true}
            }
        });
        const wId = workflow.id;
        console.log(`Workflow created: ${wId}`);
        if (!wId) {
            console.error('Failed to create workflow:', workflow);
            return;
        }

        console.log('\n2. Adding steps...');
        const mgrStep = await request(`/steps`, 'POST', { workflowId: wId, name: "Manager Approval", stepType: "APPROVAL", order: 1 });
        const finStep = await request(`/steps`, 'POST', { workflowId: wId, name: "Finance Notification", stepType: "NOTIFICATION", order: 2 });
        const ceoStep = await request(`/steps`, 'POST', { workflowId: wId, name: "CEO Approval", stepType: "APPROVAL", order: 3 });
        const taskStep = await request(`/steps`, 'POST', { workflowId: wId, name: "Task Rejection", stepType: "TASK", order: 4 });
        console.log(`Steps created: Manager (${mgrStep.id}), Finance (${finStep.id}), CEO (${ceoStep.id}), Task (${taskStep.id})`);

        console.log('\n2.5 Updating workflow start step...');
        await request(`/workflow/${wId}`, 'PATCH', { startStepId: mgrStep.id });
        console.log('Start step updated.');

        console.log('\n3. Adding rules to Manager Approval step...');
        await request(`/rules`, 'POST', { stepId: mgrStep.id, condition: 'amount > 100 && priority == "High"', nextStepId: finStep.id, priority: 1 });
        await request(`/rules`, 'POST', { stepId: mgrStep.id, condition: 'amount <= 100', nextStepId: ceoStep.id, priority: 2 });
        await request(`/rules`, 'POST', { stepId: mgrStep.id, condition: 'true', nextStepId: taskStep.id, priority: 3, isDefault: true });
        console.log('Rules added.');

        console.log('\n4. Executing workflow...');
        const execution = await request(`/executions/start`, 'POST', { workflowId: wId, context: {amount: 250, country: "US", priority: "High"} });
        console.log(`Execution started: ID=${execution.id}, Status=${execution.status}`);

        console.log('\n5. Waiting for execution to complete...');
        let execData = execution;
        let attempts = 0;
        while (execData.status !== 'COMPLETED' && execData.status !== 'FAILED' && attempts < 10) {
            await new Promise(r => setTimeout(r, 1000));
            execData = await request(`/executions/${execution.id}`, 'GET');
            console.log(`Current status: ${execData.status}`);
            attempts++;
        }

        console.log('\nExecution completed. Target Status Achieved or Timeout.');
        console.log(JSON.stringify(execData, null, 2));

    } catch (err) {
        console.error('Error executing workflow:', err);
    }
})();
