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

  if (fileContent.includes("spring.datasource.read.url=jdbc-secretsmanager")) {
    // replace read url
    let newContent = fileContent.replaceAll(
      /spring\.datasource\.read\.url=jdbc-secretsmanager:postgresql.*/gm,
      `spring.datasource.read.url=jdbc-secretsmanager:postgresql://\${com.flowfact.postgres.main-cluster.proxy.read.host}/${serviceName}?ApplicationName=${serviceName}\&${com.flowfact.postgres.connectionParams}`
    );

    // replace write url
    newContent = newContent.replaceAll(
      /spring\.datasource\.url=jdbc-secretsmanager:postgresql.*/gm,
      `spring.datasource.url=jdbc-secretsmanager:postgresql://\${com.flowfact.postgres.main-cluster.proxy.write.host}/${serviceName}?ApplicationName=${serviceName}\&${com.flowfact.postgres.connectionParams}`
    );
    Deno.writeTextFileSync(entry.name, newContent);
  } else {
    // replace write url and also read url
    const newContent = fileContent.replaceAll(
      /spring\.datasource\.url=jdbc-secretsmanager:postgresql.*/gm,
      `spring.datasource.url=jdbc-secretsmanager:postgresql://\${com.flowfact.postgres.main-cluster.proxy.write.host}/${serviceName}?ApplicationName=${serviceName}\&${com.flowfact.postgres.connectionParams}\nspring.datasource.read.url=jdbc-secretsmanager:postgresql://\${com.flowfact.postgres.main-cluster.proxy.read.host}/${serviceName}?ApplicationName=${serviceName}\&${com.flowfact.postgres.connectionParams}`
    );
    Deno.writeTextFileSync(entry.name, newContent);
  }
}
