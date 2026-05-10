const { execSync } = require('child_process');
const archiver = require('archiver');
const fs = require('fs');

const APP_NAME = 'taiwan-legislative-tracker';
const ENV_NAME = 'taiwan-tracker-prod';
const S3_BUCKET = 'taiwan-legislative-tracker-deploy-679966165097';
const REGION = 'us-east-1';

async function deploy() {
  // Step 1: Build the client
  console.log('Building client...');
  execSync('npm install --prefix client && npm run build --prefix client', {
    stdio: 'inherit',
    shell: true,
  });

  // Step 2: Create deployment zip
  console.log('\nCreating deployment zip...');
  const version = `v${Date.now()}`;
  const zipName = `deploy-${version}.zip`;

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    // Root files
    archive.file('package.json', { name: 'package.json' });
    archive.file('package-lock.json', { name: 'package-lock.json' });
    archive.file('Procfile', { name: 'Procfile' });

    // EB config
    archive.directory('.ebextensions/', '.ebextensions');

    // Server source
    archive.file('server/index.js', { name: 'server/index.js' });
    archive.directory('server/routes/', 'server/routes');
    archive.directory('server/lib/', 'server/lib');

    // Pre-built client
    archive.directory('client/dist/', 'client/dist');

    archive.finalize();
  });

  const size = Math.round(fs.statSync(zipName).size / 1024);
  console.log(`Created ${zipName} (${size} KB)`);

  // Step 3: Upload to S3
  console.log('\nUploading to S3...');
  execSync(`aws s3 cp ${zipName} s3://${S3_BUCKET}/${zipName} --region ${REGION}`, {
    stdio: 'inherit',
    shell: true,
  });

  // Step 4: Create application version
  console.log('\nCreating application version...');
  execSync(
    `aws elasticbeanstalk create-application-version --application-name ${APP_NAME} --version-label ${version} --source-bundle S3Bucket=${S3_BUCKET},S3Key=${zipName} --region ${REGION}`,
    { stdio: 'inherit', shell: true }
  );

  // Step 5: Deploy to environment
  console.log('\nDeploying to environment...');
  execSync(
    `aws elasticbeanstalk update-environment --environment-name ${ENV_NAME} --version-label ${version} --region ${REGION}`,
    { stdio: 'inherit', shell: true }
  );

  // Cleanup local zip
  fs.unlinkSync(zipName);

  console.log('\nDeployment started! It will take 1-2 minutes to go live.');
  console.log(`URL: http://${ENV_NAME}.eba-ppx7uwnh.${REGION}.elasticbeanstalk.com`);
}

deploy().catch((err) => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
