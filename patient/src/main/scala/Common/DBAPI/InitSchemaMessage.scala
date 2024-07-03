package Common.DBAPI

import Common.API.API
import Global.ServiceCenter.dbManagerServiceCode
import io.circe.generic.auto.*

case class InitSchemaMessage(schemaName: String) extends API[String](dbManagerServiceCode)