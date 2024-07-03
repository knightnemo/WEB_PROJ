package Common

import Global.GlobalVariables.serviceCode
import Global.ServiceCenter.fullNameMap
import cats.effect.IO
import com.comcast.ip4s.Port
import org.http4s.Uri


/** TODO: 应该使用数据库记录 fullNameMap和serviceCode信息 * */
object ServiceUtils{
  def getURI(serviceCode: String): IO[Uri] =
    IO.fromEither(Uri.fromString(
      "http://localhost:" + getPort(serviceCode).value.toString + "/"
    ))

  def getPort(serviceCode: String): Port =
    Port.fromInt(portMap(serviceCode)).getOrElse(
      throw new IllegalArgumentException(s"Invalid port for serviceCode: $serviceCode")
    )


  def serviceName(serviceCode: String): String = {
    val fullName = fullNameMap(serviceCode)
    val start = fullName.indexOf("（")
    val end = fullName.indexOf("）")
    fullNameMap(serviceCode).substring(start + 1, end).toLowerCase
  }

  def portMap(serviceCode: String): Int = {
    serviceCode.drop(1).toInt +
      (if (serviceCode.head == 'A') 10000 else if (serviceCode.head == 'D') 20000 else 30000)
  }


  lazy val servicePort: Int = portMap(serviceCode)
  lazy val serviceFullName: String = fullNameMap(serviceCode)
  lazy val serviceShortName: String = serviceName(serviceCode)
  lazy val schemaName: String = serviceName(serviceCode)
}
