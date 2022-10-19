for (const entry of Deno.readDirSync(".")) {
  if (!entry.isFile) continue;
  if (!entry.name.includes(".properties")) continue;
  if (entry.name.includes("-lambda")) continue;

  const fileContent = Deno.readTextFileSync(entry.name);
  const serviceName = entry.name.split(".properties")[0];

  if (entry.name.includes("production") || entry.name.includes("staging") || entry.name.includes("development")) {
    // remove hardcoded values
    const newContent = fileContent.replaceAll(/spring.datasource.url=.*aurora-encr.*/gm, "");
    Deno.writeTextFileSync(entry.name, newContent);
    continue;
  }

  if (
    !fileContent.includes(
      "spring.datasource.url=jdbc-secretsmanager:postgresql://${com.flowfact.postgres.main-cluster.write.host}"
    ) &&
    !/spring.datasource.url=.*aurora-enc.*/gm.test(fileContent)
  )
    continue;

  console.log("replacing in " + entry.name);

  const connStringParams = "${com.flowfact.postgres.connectionStringParams}";
  const urlSuffix = `${serviceName}?ApplicationName=${serviceName}${connStringParams}`;
  const readUrl = `spring.datasource.read.url=jdbc-secretsmanager:postgresql://\${com.flowfact.postgres.main-cluster.proxy.read.host}/${urlSuffix}`;
  const writeUrl = `spring.datasource.url=jdbc-secretsmanager:postgresql://\${com.flowfact.postgres.main-cluster.proxy.write.host}/${urlSuffix}`;
  if (fileContent.includes("spring.datasource.read.url=jdbc-secretsmanager")) {
    // replace read url
    let newContent = fileContent.replaceAll(
      /spring\.datasource\.read\.url=jdbc-secretsmanager:postgresql.*/gm,
      readUrl
    );

    // replace write url
    newContent = newContent.replaceAll(/spring\.datasource\.url=jdbc-secretsmanager:postgresql.*/gm, writeUrl);
    Deno.writeTextFileSync(entry.name, newContent);
  } else {
    // replace write url and also read url
    const newContent = fileContent.replaceAll(
      /spring\.datasource\.url=jdbc-secretsmanager:postgresql.*/gm,
      `${writeUrl}\n${readUrl}`
    );
    Deno.writeTextFileSync(entry.name, newContent);
  }
}
