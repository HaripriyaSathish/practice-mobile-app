# Use PyMySQL as the MySQL driver (no C compiler needed on Windows)
import pymysql

pymysql.version_info = (2, 2, 1, "final", 0)
pymysql.install_as_MySQLdb()
