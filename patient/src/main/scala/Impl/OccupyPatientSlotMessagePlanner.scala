package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.PatientAPI.OccupyPatientSlotMessage

case class OccupyPatientSlotMessagePlanner(message: OccupyPatientSlotMessage, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using planContext: PlanContext): IO[String] = {
    val OccupyPatientSlotMessage(patientName, slotNumber, courseName) = message

    val checkSlotAvailable = readDBBoolean(
      s"SELECT slot$slotNumber = '0' FROM ${schemaName}.patients WHERE user_name = ?",
      List(SqlParameter("String", patientName))
    )

    checkSlotAvailable.flatMap { isAvailable =>
      if (isAvailable) {
        writeDB(
          s"UPDATE ${schemaName}.patients SET slot$slotNumber = ? WHERE user_name = ?",
          List(SqlParameter("String", courseName), SqlParameter("String", patientName))
        ).map(_ => s"Slot $slotNumber for patient $patientName has been occupied with course $courseName")
      } else {
        IO.raiseError(new Exception(s"Slot $slotNumber for patient $patientName is already occupied"))
      }
    }
  }