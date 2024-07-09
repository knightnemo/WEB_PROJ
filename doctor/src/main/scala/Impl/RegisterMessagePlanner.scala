package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.DoctorAPI.DoctorInfo

case class RegisterMessagePlanner(userName: String, password: String, bio: Option[String], gender: Option[String], override val planContext: PlanContext) extends Planner[String]:
  override def plan(using planContext: PlanContext): IO[String] = {
    // 检查用户是否已经存在于数据库中
    val checkUserExists = readDBBoolean(
      s"SELECT EXISTS(SELECT 1 FROM ${schemaName}.user_name WHERE user_name = ?)",
      List(SqlParameter("String", userName))
    )

    checkUserExists.flatMap { exists =>
      if (exists) {
        // 如果用户已存在，返回错误信息
        IO.raiseError(new Exception("already registered"))
      } else {
        // 如果用户不存在，开始注册流程
        for {
          // 向 user_name 表中插入用户名、密码和性别信息
          _ <- writeDB(
            s"INSERT INTO ${schemaName}.user_name (user_name, password, gender) VALUES (?, ?, ?)",
            List(
              SqlParameter("String", userName),
              SqlParameter("String", password),
              SqlParameter("String", gender.getOrElse("")) // 插入性别，如果未提供则使用空字符串
            )
          )
          // 向 doctors 表中插入用户名和个人简介信息
          _ <- writeDB(
            s"""
            INSERT INTO ${schemaName}.doctors
            (user_name, bio, followers, following, review_count)
            VALUES (?, ?, 0, 0, 0)
            """,
            List(
              SqlParameter("String", userName),
              SqlParameter("String", bio.getOrElse("")) // 插入个人简介，如果未提供则使用空字符串
            )
          )
        } yield "User registered successfully" // 注册成功后返回成功信息
      }
    }
  }
