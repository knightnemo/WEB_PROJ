package Global

import Global.ServiceCenter.{courseServiceCode, fileServiceCode}

object GlobalVariables:
  val serviceCodes: Map[String, String] = Map(
    "Course" -> courseServiceCode,
    "File" -> fileServiceCode
  )

  def getServiceCode(service: String): String =
    serviceCodes.getOrElse(service, throw new IllegalArgumentException(s"Unknown service: $service"))

  // 保留原来的 serviceCode 以保持向后兼容性
  val serviceCode: String = courseServiceCode